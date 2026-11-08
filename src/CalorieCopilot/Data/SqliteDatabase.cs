using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Options;

namespace CalorieCopilot.Data;

/// <summary>Local SQLite back end, used when no Turso URL is configured (offline development, tests).</summary>
public sealed class SqliteDatabase : IDatabase
{
    private readonly string _connectionString;

    public SqliteDatabase(IOptions<DatabaseOptions> options, IHostEnvironment env)
    {
        var path = options.Value.SqlitePath;
        if (!Path.IsPathRooted(path))
        {
            path = Path.Combine(env.ContentRootPath, path);
        }
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = path,
            Mode = SqliteOpenMode.ReadWriteCreate,
            DefaultTimeout = 30,
        }.ToString();
    }

    public async Task<SqlResult> ExecuteAsync(SqlStatement statement, CancellationToken ct = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(ct);
        return await RunAsync(connection, null, statement, ct);
    }

    public async Task<IReadOnlyList<SqlResult>> TransactionAsync(IReadOnlyList<SqlStatement> statements, CancellationToken ct = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(ct);
        await using var tx = (SqliteTransaction)await connection.BeginTransactionAsync(ct);
        var results = new List<SqlResult>(statements.Count);
        foreach (var statement in statements)
        {
            results.Add(await RunAsync(connection, tx, statement, ct));
        }
        await tx.CommitAsync(ct);
        return results;
    }

    private static async Task<SqlResult> RunAsync(SqliteConnection connection, SqliteTransaction? tx, SqlStatement statement, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = tx;
        command.CommandText = RewritePlaceholders(statement.Sql);
        for (var i = 0; i < statement.Args.Length; i++)
        {
            command.Parameters.AddWithValue("@p" + i, DatabaseExtensions.NormalizeArg(statement.Args[i]) ?? DBNull.Value);
        }

        await using var reader = await command.ExecuteReaderAsync(ct);
        var columns = Enumerable.Range(0, reader.FieldCount).Select(reader.GetName).ToArray();
        var rows = new List<DbRow>();
        while (await reader.ReadAsync(ct))
        {
            var values = new object?[columns.Length];
            for (var i = 0; i < columns.Length; i++)
            {
                values[i] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }
            rows.Add(new DbRow(columns, values));
        }
        var affected = reader.RecordsAffected;
        await reader.CloseAsync();

        long? lastId = null;
        if (affected > 0 && statement.Sql.TrimStart().StartsWith("INSERT", StringComparison.OrdinalIgnoreCase))
        {
            await using var idCmd = connection.CreateCommand();
            idCmd.Transaction = tx;
            idCmd.CommandText = "SELECT last_insert_rowid()";
            lastId = (long)(await idCmd.ExecuteScalarAsync(ct))!;
        }
        return new SqlResult(columns, rows, Math.Max(affected, 0), lastId);
    }

    /// <summary>Rewrites positional <c>?</c> placeholders (as used by Turso) to <c>@p0, @p1, ...</c>.</summary>
    internal static string RewritePlaceholders(string sql)
    {
        if (!sql.Contains('?'))
        {
            return sql;
        }

        var sb = new System.Text.StringBuilder(sql.Length + 16);
        var index = 0;
        var inString = false;
        foreach (var c in sql)
        {
            if (c == '\'')
            {
                inString = !inString;
            }
            if (c == '?' && !inString)
            {
                sb.Append("@p").Append(index++);
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }
}
