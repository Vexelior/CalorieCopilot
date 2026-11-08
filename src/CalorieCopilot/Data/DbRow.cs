using System.Globalization;

namespace CalorieCopilot.Data;

/// <summary>A result row with typed, case-insensitive column accessors.</summary>
public sealed class DbRow
{
    private readonly Dictionary<string, object?> _values;

    public DbRow(IReadOnlyList<string> columns, object?[] values)
    {
        _values = new Dictionary<string, object?>(columns.Count, StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < columns.Count; i++)
        {
            _values[columns[i]] = values[i];
        }
    }

    public object? this[string column] =>
        _values.TryGetValue(column, out var v) ? v : throw new KeyNotFoundException($"Column '{column}' not in result.");

    public bool IsNull(string column) => this[column] is null;

    public string? GetString(string column) => this[column] switch
    {
        null => null,
        string s => s,
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        var o => o.ToString(),
    };

    public long GetInt64(string column) => GetNullableInt64(column) ?? 0;

    public long? GetNullableInt64(string column) => this[column] switch
    {
        null => null,
        long l => l,
        double d => (long)d,
        string s => long.Parse(s, CultureInfo.InvariantCulture),
        var o => Convert.ToInt64(o, CultureInfo.InvariantCulture),
    };

    public int GetInt32(string column) => (int)GetInt64(column);

    public double GetDouble(string column) => GetNullableDouble(column) ?? 0;

    public double? GetNullableDouble(string column) => this[column] switch
    {
        null => null,
        double d => d,
        long l => l,
        string s => double.Parse(s, CultureInfo.InvariantCulture),
        var o => Convert.ToDouble(o, CultureInfo.InvariantCulture),
    };

    public bool GetBoolean(string column) => GetInt64(column) != 0;

    public DateTimeOffset? GetNullableDateTimeOffset(string column) =>
        GetString(column) is { } s ? DateTimeOffset.Parse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal) : null;

    public DateOnly? GetNullableDateOnly(string column) =>
        GetString(column) is { } s ? DateOnly.ParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture) : null;

    public DateOnly GetDateOnly(string column) => GetNullableDateOnly(column) ?? default;
}
