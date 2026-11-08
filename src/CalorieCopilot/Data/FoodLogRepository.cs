using CalorieCopilot.Models;

namespace CalorieCopilot.Data;

public sealed class FoodLogRepository(IDatabase db)
{
    private const string Columns =
        "Id, UserId, EntryDate, Meal, Name, Brand, Barcode, ServingDescription, Servings, Calories, ProteinG, CarbsG, FatG, CreatedAt";

    public async Task<IReadOnlyList<FoodEntry>> GetEntriesAsync(string userId, DateOnly date)
        => (await db.QueryAsync($"SELECT {Columns} FROM FoodEntries WHERE UserId = ? AND EntryDate = ? ORDER BY CreatedAt", userId, date))
            .Select(Map).ToList();

    public async Task<FoodEntry?> GetEntryAsync(string userId, long id)
        => await db.QuerySingleAsync($"SELECT {Columns} FROM FoodEntries WHERE UserId = ? AND Id = ?", userId, id) is { } r ? Map(r) : null;

    public async Task<long> AddAsync(FoodEntry e)
    {
        var result = await db.ExecuteAsync(
            "INSERT INTO FoodEntries (UserId, EntryDate, Meal, Name, Brand, Barcode, ServingDescription, Servings, Calories, ProteinG, CarbsG, FatG, CreatedAt) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            e.UserId, e.EntryDate, e.Meal, e.Name, e.Brand, e.Barcode, e.ServingDescription, e.Servings, e.Calories, e.ProteinG, e.CarbsG, e.FatG, DateTimeOffset.UtcNow);
        return result.LastInsertRowId ?? 0;
    }

    public Task UpdateAsync(FoodEntry e) => db.ExecuteAsync(
        "UPDATE FoodEntries SET EntryDate = ?, Meal = ?, Name = ?, Brand = ?, ServingDescription = ?, Servings = ?, Calories = ?, ProteinG = ?, CarbsG = ?, FatG = ? " +
        "WHERE Id = ? AND UserId = ?",
        e.EntryDate, e.Meal, e.Name, e.Brand, e.ServingDescription, e.Servings, e.Calories, e.ProteinG, e.CarbsG, e.FatG, e.Id, e.UserId);

    public Task DeleteAsync(string userId, long id) => db.ExecuteAsync("DELETE FROM FoodEntries WHERE Id = ? AND UserId = ?", id, userId);

    /// <summary>Totals per day (inclusive range). Days with no entries are filled with zeros.</summary>
    public async Task<IReadOnlyList<DailyTotals>> GetDailyTotalsAsync(string userId, DateOnly from, DateOnly to)
    {
        var rows = await db.QueryAsync(
            "SELECT EntryDate, SUM(Calories * Servings) AS Calories, SUM(ProteinG * Servings) AS ProteinG, " +
            "SUM(CarbsG * Servings) AS CarbsG, SUM(FatG * Servings) AS FatG, COUNT(*) AS EntryCount " +
            "FROM FoodEntries WHERE UserId = ? AND EntryDate BETWEEN ? AND ? GROUP BY EntryDate",
            userId, from, to);

        var byDate = rows.ToDictionary(r => r.GetDateOnly("EntryDate"));
        var result = new List<DailyTotals>();
        for (var d = from; d <= to; d = d.AddDays(1))
        {
            result.Add(byDate.TryGetValue(d, out var r)
                ? new DailyTotals(d, r.GetDouble("Calories"), r.GetDouble("ProteinG"), r.GetDouble("CarbsG"), r.GetDouble("FatG"), r.GetInt32("EntryCount"))
                : new DailyTotals(d, 0, 0, 0, 0, 0));
        }
        return result;
    }

    public async Task<IReadOnlyDictionary<Meal, double>> GetCaloriesByMealAsync(string userId, DateOnly from, DateOnly to)
    {
        var rows = await db.QueryAsync(
            "SELECT Meal, SUM(Calories * Servings) AS Calories FROM FoodEntries WHERE UserId = ? AND EntryDate BETWEEN ? AND ? GROUP BY Meal",
            userId, from, to);
        return rows
            .Where(r => Enum.TryParse<Meal>(r.GetString("Meal"), out _))
            .ToDictionary(r => Enum.Parse<Meal>(r.GetString("Meal")!), r => r.GetDouble("Calories"));
    }

    public async Task<IReadOnlyList<TopFood>> GetTopFoodsAsync(string userId, DateOnly from, DateOnly to, int limit = 8)
        => (await db.QueryAsync(
                "SELECT Name, Brand, COUNT(*) AS TimesLogged, SUM(Calories * Servings) AS TotalCalories FROM FoodEntries " +
                "WHERE UserId = ? AND EntryDate BETWEEN ? AND ? GROUP BY Name, Brand ORDER BY TimesLogged DESC, TotalCalories DESC LIMIT ?",
                userId, from, to, limit))
            .Select(r => new TopFood(r.GetString("Name")!, r.GetString("Brand"), r.GetInt32("TimesLogged"), r.GetDouble("TotalCalories")))
            .ToList();

    /// <summary>Most recently logged distinct foods, for one-tap re-logging.</summary>
    public async Task<IReadOnlyList<RecentFood>> GetRecentFoodsAsync(string userId, int limit = 8)
        => (await db.QueryAsync(
                "SELECT f.Name, f.Brand, f.Barcode, f.ServingDescription, f.Calories, f.ProteinG, f.CarbsG, f.FatG, g.TimesLogged " +
                "FROM FoodEntries f JOIN (SELECT MAX(Id) AS LastId, COUNT(*) AS TimesLogged FROM FoodEntries WHERE UserId = ? " +
                "GROUP BY Name, IFNULL(Brand, '')) g ON f.Id = g.LastId ORDER BY f.Id DESC LIMIT ?",
                userId, limit))
            .Select(r => new RecentFood(r.GetString("Name")!, r.GetString("Brand"), r.GetString("Barcode"), r.GetString("ServingDescription"),
                r.GetDouble("Calories"), r.GetDouble("ProteinG"), r.GetDouble("CarbsG"), r.GetDouble("FatG"), r.GetInt32("TimesLogged")))
            .ToList();

    /// <summary>Consecutive days (ending today or yesterday) with at least one entry.</summary>
    public async Task<int> GetStreakAsync(string userId, DateOnly today)
    {
        var dates = (await db.QueryAsync(
                "SELECT DISTINCT EntryDate FROM FoodEntries WHERE UserId = ? AND EntryDate <= ? ORDER BY EntryDate DESC LIMIT 400", userId, today))
            .Select(r => r.GetDateOnly("EntryDate"))
            .ToHashSet();

        var day = dates.Contains(today) ? today : today.AddDays(-1);
        var streak = 0;
        while (dates.Contains(day))
        {
            streak++;
            day = day.AddDays(-1);
        }
        return streak;
    }

    private static FoodEntry Map(DbRow r) => new()
    {
        Id = r.GetInt64("Id"),
        UserId = r.GetString("UserId")!,
        EntryDate = r.GetDateOnly("EntryDate"),
        Meal = Enum.TryParse<Meal>(r.GetString("Meal"), out var m) ? m : Meal.Snack,
        Name = r.GetString("Name")!,
        Brand = r.GetString("Brand"),
        Barcode = r.GetString("Barcode"),
        ServingDescription = r.GetString("ServingDescription"),
        Servings = r.GetDouble("Servings"),
        Calories = r.GetDouble("Calories"),
        ProteinG = r.GetDouble("ProteinG"),
        CarbsG = r.GetDouble("CarbsG"),
        FatG = r.GetDouble("FatG"),
        CreatedAt = r.GetNullableDateTimeOffset("CreatedAt") ?? DateTimeOffset.MinValue,
    };
}
