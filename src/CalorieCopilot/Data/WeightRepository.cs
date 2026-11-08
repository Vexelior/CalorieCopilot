using CalorieCopilot.Models;

namespace CalorieCopilot.Data;

public sealed class WeightRepository(IDatabase db)
{
    public Task UpsertAsync(string userId, DateOnly date, double weightKg) => db.ExecuteAsync(
        "INSERT INTO WeightLogs (UserId, LogDate, WeightKg) VALUES (?, ?, ?) ON CONFLICT (UserId, LogDate) DO UPDATE SET WeightKg = excluded.WeightKg",
        userId, date, weightKg);

    public async Task<IReadOnlyList<WeightLog>> GetRangeAsync(string userId, DateOnly from, DateOnly to)
        => (await db.QueryAsync("SELECT LogDate, WeightKg FROM WeightLogs WHERE UserId = ? AND LogDate BETWEEN ? AND ? ORDER BY LogDate", userId, from, to))
            .Select(r => new WeightLog(r.GetDateOnly("LogDate"), r.GetDouble("WeightKg")))
            .ToList();
}
