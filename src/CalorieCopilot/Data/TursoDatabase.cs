using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace CalorieCopilot.Data;

/// <summary>
/// Talks to a Turso (libSQL) database using the Hrana-over-HTTP protocol (<c>POST /v2/pipeline</c>).
/// Pure managed code: no native libSQL binaries are needed, so it runs anywhere .NET runs.
/// </summary>
public sealed class TursoDatabase : IDatabase
{
    public const string HttpClientName = "turso";

    private readonly HttpClient _http;
    private readonly ILogger<TursoDatabase> _logger;

    public TursoDatabase(IHttpClientFactory httpClientFactory, IOptions<DatabaseOptions> options, ILogger<TursoDatabase> logger)
    {
        _http = httpClientFactory.CreateClient(HttpClientName);
        _logger = logger;
        ConfigureClient(_http, options.Value);
    }

    internal static void ConfigureClient(HttpClient http, DatabaseOptions options)
    {
        http.BaseAddress ??= new Uri(ToHttpUrl(options.TursoUrl!).TrimEnd('/') + "/");
        if (!string.IsNullOrWhiteSpace(options.TursoAuthToken) && http.DefaultRequestHeaders.Authorization is null)
        {
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", options.TursoAuthToken);
        }
    }

    /// <summary>Turso hands out <c>libsql://</c> URLs; the HTTP API lives at the same host over https.</summary>
    public static string ToHttpUrl(string url)
    {
        url = url.Trim();
        if (url.StartsWith("libsql://", StringComparison.OrdinalIgnoreCase))
        {
            return "https://" + url["libsql://".Length..];
        }
        if (url.StartsWith("wss://", StringComparison.OrdinalIgnoreCase))
        {
            return "https://" + url["wss://".Length..];
        }
        if (url.StartsWith("ws://", StringComparison.OrdinalIgnoreCase))
        {
            return "http://" + url["ws://".Length..];
        }
        return url;
    }

    public async Task<SqlResult> ExecuteAsync(SqlStatement statement, CancellationToken ct = default)
    {
        var request = new JsonObject
        {
            ["type"] = "execute",
            ["stmt"] = BuildStatement(statement),
        };

        var response = await SendAsync(request, ct);
        return ParseResult(response["result"]!);
    }

    public async Task<IReadOnlyList<SqlResult>> TransactionAsync(IReadOnlyList<SqlStatement> statements, CancellationToken ct = default)
    {
        if (statements.Count == 0)
        {
            return [];
        }

        // Hrana batch: BEGIN; each statement runs only if the previous step succeeded; COMMIT if all ok,
        // otherwise ROLLBACK. This gives us real atomicity in a single round trip.
        var steps = new JsonArray { new JsonObject { ["stmt"] = BuildStatement(new SqlStatement("BEGIN")) } };
        for (var i = 0; i < statements.Count; i++)
        {
            steps.Add(new JsonObject
            {
                ["condition"] = OkCondition(i),
                ["stmt"] = BuildStatement(statements[i]),
            });
        }

        var commitStep = statements.Count + 1;
        steps.Add(new JsonObject { ["condition"] = OkCondition(statements.Count), ["stmt"] = BuildStatement(new SqlStatement("COMMIT")) });
        steps.Add(new JsonObject
        {
            ["condition"] = new JsonObject { ["type"] = "not", ["cond"] = OkCondition(commitStep) },
            ["stmt"] = BuildStatement(new SqlStatement("ROLLBACK")),
        });

        var request = new JsonObject { ["type"] = "batch", ["batch"] = new JsonObject { ["steps"] = steps } };
        var response = await SendAsync(request, ct);
        var result = response["result"]!;
        var stepResults = result["step_results"]!.AsArray();
        var stepErrors = result["step_errors"]!.AsArray();

        // Skip BEGIN (index 0); report the first real error.
        for (var i = 0; i < stepErrors.Count; i++)
        {
            if (stepErrors[i] is JsonObject err)
            {
                throw new TursoException(err["message"]?.GetValue<string>() ?? "Unknown error", err["code"]?.GetValue<string>());
            }
        }

        var results = new List<SqlResult>(statements.Count);
        for (var i = 1; i <= statements.Count; i++)
        {
            results.Add(stepResults[i] is { } r ? ParseResult(r) : SqlResult.Empty);
        }
        return results;
    }

    private static JsonObject OkCondition(int step) => new() { ["type"] = "ok", ["step"] = step };

    private async Task<JsonNode> SendAsync(JsonObject request, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["requests"] = new JsonArray { request, new JsonObject { ["type"] = "close" } },
        };

        // Buffered body (explicit Content-Length) rather than chunked streaming: works with every proxy/edge.
        using var content = new StringContent(body.ToJsonString(), System.Text.Encoding.UTF8, "application/json");
        using var httpResponse = await _http.PostAsync("v2/pipeline", content, ct);
        var text = await httpResponse.Content.ReadAsStringAsync(ct);
        if (!httpResponse.IsSuccessStatusCode)
        {
            _logger.LogError("Turso request failed with {Status}: {Body}", (int)httpResponse.StatusCode, text);
            throw new TursoException($"Turso HTTP {(int)httpResponse.StatusCode}: {text}", null);
        }

        var json = JsonNode.Parse(text)!;
        var first = json["results"]![0]!;
        if (first["type"]!.GetValue<string>() == "error")
        {
            var error = first["error"]!;
            throw new TursoException(error["message"]?.GetValue<string>() ?? "Unknown error", error["code"]?.GetValue<string>());
        }
        return first["response"]!;
    }

    private static JsonObject BuildStatement(SqlStatement statement)
    {
        var args = new JsonArray();
        foreach (var raw in statement.Args)
        {
            args.Add(ToValue(DatabaseExtensions.NormalizeArg(raw)));
        }
        return new JsonObject { ["sql"] = statement.Sql, ["args"] = args, ["want_rows"] = true };
    }

    private static JsonObject ToValue(object? value) => value switch
    {
        null => new JsonObject { ["type"] = "null" },
        long l => new JsonObject { ["type"] = "integer", ["value"] = l.ToString(CultureInfo.InvariantCulture) },
        double d when double.IsFinite(d) => new JsonObject { ["type"] = "float", ["value"] = d },
        double => new JsonObject { ["type"] = "null" },
        byte[] b => new JsonObject { ["type"] = "blob", ["base64"] = Convert.ToBase64String(b) },
        _ => new JsonObject { ["type"] = "text", ["value"] = (string)value },
    };

    private static SqlResult ParseResult(JsonNode result)
    {
        var columns = result["cols"]!.AsArray()
            .Select((c, i) => c?["name"]?.GetValue<string>() ?? $"col{i}")
            .ToArray();

        var rows = new List<DbRow>();
        foreach (var row in result["rows"]!.AsArray())
        {
            var cells = row!.AsArray();
            var values = new object?[columns.Length];
            for (var i = 0; i < columns.Length; i++)
            {
                values[i] = FromValue(cells[i]);
            }
            rows.Add(new DbRow(columns, values));
        }

        var affected = result["affected_row_count"]?.GetValue<long>() ?? 0;
        long? lastId = result["last_insert_rowid"] switch
        {
            null => null,
            JsonValue v when v.GetValueKind() == JsonValueKind.String => long.Parse(v.GetValue<string>(), CultureInfo.InvariantCulture),
            JsonValue v when v.GetValueKind() == JsonValueKind.Number => v.GetValue<long>(),
            _ => null,
        };
        return new SqlResult(columns, rows, affected, lastId);
    }

    private static object? FromValue(JsonNode? cell)
    {
        if (cell is null)
        {
            return null;
        }

        return cell["type"]?.GetValue<string>() switch
        {
            "integer" => cell["value"] is JsonValue iv && iv.GetValueKind() == JsonValueKind.String
                ? long.Parse(iv.GetValue<string>(), CultureInfo.InvariantCulture)
                : cell["value"]!.GetValue<long>(),
            "float" => cell["value"]!.GetValue<double>(),
            "text" => cell["value"]!.GetValue<string>(),
            "blob" => Convert.FromBase64String(cell["base64"]!.GetValue<string>()),
            _ => null,
        };
    }
}

public sealed class TursoException(string message, string? code) : Exception(message)
{
    public string? Code { get; } = code;
}
