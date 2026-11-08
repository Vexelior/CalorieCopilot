namespace CalorieCopilot.Data;

/// <summary>Creates the schema on startup. All statements are idempotent.</summary>
public sealed class DatabaseInitializer(IDatabase db, ILogger<DatabaseInitializer> logger) : IHostedService
{
    private static readonly string[] Schema =
    [
        """
        CREATE TABLE IF NOT EXISTS Users (
            Id                 TEXT PRIMARY KEY,
            UserName           TEXT NOT NULL,
            NormalizedUserName TEXT NOT NULL UNIQUE,
            Email              TEXT,
            NormalizedEmail    TEXT,
            EmailConfirmed     INTEGER NOT NULL DEFAULT 0,
            PasswordHash       TEXT,
            SecurityStamp      TEXT,
            ConcurrencyStamp   TEXT,
            LockoutEnd         TEXT,
            LockoutEnabled     INTEGER NOT NULL DEFAULT 1,
            AccessFailedCount  INTEGER NOT NULL DEFAULT 0,
            DisplayName        TEXT,
            Sex                TEXT,
            BirthDate          TEXT,
            HeightCm           REAL,
            WeightKg           REAL,
            ActivityLevel      TEXT NOT NULL DEFAULT 'Moderate',
            WeightGoal         TEXT NOT NULL DEFAULT 'Maintain',
            DailyCalorieGoal   INTEGER NOT NULL DEFAULT 2000,
            ProteinGoalG       INTEGER NOT NULL DEFAULT 150,
            CarbsGoalG         INTEGER NOT NULL DEFAULT 200,
            FatGoalG           INTEGER NOT NULL DEFAULT 67,
            TimeZone           TEXT NOT NULL DEFAULT 'UTC',
            UseMetric          INTEGER NOT NULL DEFAULT 1,
            CreatedAt          TEXT NOT NULL
        )
        """,
        "CREATE INDEX IF NOT EXISTS IX_Users_NormalizedEmail ON Users (NormalizedEmail)",
        """
        CREATE TABLE IF NOT EXISTS FoodEntries (
            Id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            UserId             TEXT NOT NULL,
            EntryDate          TEXT NOT NULL,
            Meal               TEXT NOT NULL,
            Name               TEXT NOT NULL,
            Brand              TEXT,
            Barcode            TEXT,
            ServingDescription TEXT,
            Servings           REAL NOT NULL DEFAULT 1,
            Calories           REAL NOT NULL,
            ProteinG           REAL NOT NULL DEFAULT 0,
            CarbsG             REAL NOT NULL DEFAULT 0,
            FatG               REAL NOT NULL DEFAULT 0,
            CreatedAt          TEXT NOT NULL
        )
        """,
        "CREATE INDEX IF NOT EXISTS IX_FoodEntries_User_Date ON FoodEntries (UserId, EntryDate)",
        """
        CREATE TABLE IF NOT EXISTS Products (
            Barcode            TEXT NOT NULL,
            OwnerId            TEXT NOT NULL DEFAULT '',
            Name               TEXT NOT NULL,
            Brand              TEXT,
            ServingDescription TEXT,
            ServingGrams       REAL,
            CaloriesPer100g    REAL,
            ProteinPer100g     REAL,
            CarbsPer100g       REAL,
            FatPer100g         REAL,
            CaloriesPerServing REAL,
            ProteinPerServing  REAL,
            CarbsPerServing    REAL,
            FatPerServing      REAL,
            ImageUrl           TEXT,
            Source             TEXT NOT NULL,
            UpdatedAt          TEXT NOT NULL,
            PRIMARY KEY (Barcode, OwnerId)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS WeightLogs (
            Id       INTEGER PRIMARY KEY AUTOINCREMENT,
            UserId   TEXT NOT NULL,
            LogDate  TEXT NOT NULL,
            WeightKg REAL NOT NULL,
            UNIQUE (UserId, LogDate)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS DataProtectionKeys (
            FriendlyName TEXT PRIMARY KEY,
            Xml          TEXT NOT NULL,
            CreatedAt    TEXT NOT NULL
        )
        """,
    ];

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Ensuring database schema using {Backend}", db.GetType().Name);
        await db.TransactionAsync(Schema.Select(sql => new SqlStatement(sql)).ToList(), cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
