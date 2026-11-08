namespace CalorieCopilot.Data;

/// <summary>A single parameterised SQL statement. Use positional <c>?</c> placeholders.</summary>
public sealed record SqlStatement(string Sql, params object?[] Args);

/// <summary>Result of executing one statement.</summary>
public sealed class SqlResult
{
    public static readonly SqlResult Empty = new([], [], 0, null);

    public SqlResult(IReadOnlyList<string> columns, IReadOnlyList<DbRow> rows, long rowsAffected, long? lastInsertRowId)
    {
        Columns = columns;
        Rows = rows;
        RowsAffected = rowsAffected;
        LastInsertRowId = lastInsertRowId;
    }

    public IReadOnlyList<string> Columns { get; }
    public IReadOnlyList<DbRow> Rows { get; }
    public long RowsAffected { get; }
    public long? LastInsertRowId { get; }
}

/// <summary>
/// Minimal database abstraction. Implemented by <see cref="TursoDatabase"/> (Turso / libSQL over HTTP)
/// and <see cref="SqliteDatabase"/> (local SQLite file for offline development).
/// Values in returned rows are normalised to <see cref="long"/>, <see cref="double"/>,
/// <see cref="string"/>, <see cref="byte"/>[] or <c>null</c>.
/// </summary>
public interface IDatabase
{
    Task<SqlResult> ExecuteAsync(SqlStatement statement, CancellationToken ct = default);

    /// <summary>Runs all statements atomically inside a transaction.</summary>
    Task<IReadOnlyList<SqlResult>> TransactionAsync(IReadOnlyList<SqlStatement> statements, CancellationToken ct = default);
}

public static class DatabaseExtensions
{
    public static Task<SqlResult> ExecuteAsync(this IDatabase db, string sql, params object?[] args)
        => db.ExecuteAsync(new SqlStatement(sql, args));

    public static async Task<IReadOnlyList<DbRow>> QueryAsync(this IDatabase db, string sql, params object?[] args)
        => (await db.ExecuteAsync(new SqlStatement(sql, args))).Rows;

    public static async Task<DbRow?> QuerySingleAsync(this IDatabase db, string sql, params object?[] args)
    {
        var rows = (await db.ExecuteAsync(new SqlStatement(sql, args))).Rows;
        return rows.Count > 0 ? rows[0] : null;
    }

    /// <summary>
    /// Converts CLR values to the primitive set understood by both back ends.
    /// </summary>
    public static object? NormalizeArg(object? value) => value switch
    {
        null => null,
        string or long or double or byte[] => value,
        bool b => b ? 1L : 0L,
        int i => (long)i,
        short s => (long)s,
        byte b => (long)b,
        float f => (double)f,
        decimal m => (double)m,
        DateOnly d => d.ToString("yyyy-MM-dd"),
        DateTimeOffset dto => dto.ToUniversalTime().ToString("O"),
        DateTime dt => dt.ToUniversalTime().ToString("O"),
        Guid g => g.ToString(),
        Enum e => e.ToString(),
        _ => value.ToString(),
    };
}
