namespace CalorieCopilot.Data;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    /// <summary>
    /// Turso database URL, e.g. <c>libsql://my-db-myorg.turso.io</c> (or <c>http://127.0.0.1:8080</c> for <c>turso dev</c>).
    /// When empty, the app falls back to a local SQLite file (<see cref="SqlitePath"/>).
    /// </summary>
    public string? TursoUrl { get; set; }

    /// <summary>Turso database auth token (<c>turso db tokens create &lt;db&gt;</c>).</summary>
    public string? TursoAuthToken { get; set; }

    /// <summary>Local SQLite file used when no Turso URL is configured.</summary>
    public string SqlitePath { get; set; } = "App_Data/caloriecopilot.db";

    public bool UseTurso => !string.IsNullOrWhiteSpace(TursoUrl);
}
