using CalorieCopilot.Data;
using CalorieCopilot.Models;
using Microsoft.AspNetCore.Identity;

namespace CalorieCopilot.Identity;

/// <summary>
/// ASP.NET Core Identity user store backed by <see cref="IDatabase"/> (Turso or SQLite).
/// Supports passwords, email, security stamps and lockout.
/// </summary>
public sealed class DatabaseUserStore(IDatabase db, IdentityErrorDescriber errors) :
    IUserPasswordStore<AppUser>,
    IUserEmailStore<AppUser>,
    IUserSecurityStampStore<AppUser>,
    IUserLockoutStore<AppUser>
{
    private const string Columns =
        "Id, UserName, NormalizedUserName, Email, NormalizedEmail, EmailConfirmed, PasswordHash, SecurityStamp, ConcurrencyStamp, " +
        "LockoutEnd, LockoutEnabled, AccessFailedCount, DisplayName, Sex, BirthDate, HeightCm, WeightKg, ActivityLevel, WeightGoal, " +
        "DailyCalorieGoal, ProteinGoalG, CarbsGoalG, FatGoalG, TimeZone, UseMetric, CreatedAt";

    public void Dispose() { }

    // ---- IUserStore ----------------------------------------------------------------------------

    public async Task<IdentityResult> CreateAsync(AppUser user, CancellationToken ct)
    {
        user.ConcurrencyStamp ??= Guid.NewGuid().ToString();
        try
        {
            await db.ExecuteAsync(new SqlStatement(
                $"INSERT INTO Users ({Columns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ToArgs(user, user.ConcurrencyStamp)), ct);
        }
        catch (Exception ex) when (ex.Message.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase))
        {
            return IdentityResult.Failed(errors.DuplicateUserName(user.UserName ?? ""));
        }
        return IdentityResult.Success;
    }

    public async Task<IdentityResult> UpdateAsync(AppUser user, CancellationToken ct)
    {
        var expectedStamp = user.ConcurrencyStamp;
        var newStamp = Guid.NewGuid().ToString();
        var args = ToArgs(user, newStamp).Skip(1).Append(user.Id).Append(expectedStamp).ToArray();

        var setClause = string.Join(", ", Columns.Split(", ").Skip(1).Select(c => $"{c} = ?"));
        var result = await db.ExecuteAsync(new SqlStatement(
            $"UPDATE Users SET {setClause} WHERE Id = ? AND (ConcurrencyStamp = ? OR ConcurrencyStamp IS NULL)", args), ct);

        if (result.RowsAffected == 0)
        {
            return IdentityResult.Failed(errors.ConcurrencyFailure());
        }
        user.ConcurrencyStamp = newStamp;
        return IdentityResult.Success;
    }

    public async Task<IdentityResult> DeleteAsync(AppUser user, CancellationToken ct)
    {
        await db.TransactionAsync(
        [
            new SqlStatement("DELETE FROM FoodEntries WHERE UserId = ?", user.Id),
            new SqlStatement("DELETE FROM WeightLogs WHERE UserId = ?", user.Id),
            new SqlStatement("DELETE FROM Products WHERE OwnerId = ?", user.Id),
            new SqlStatement("DELETE FROM Users WHERE Id = ?", user.Id),
        ], ct);
        return IdentityResult.Success;
    }

    public async Task<AppUser?> FindByIdAsync(string userId, CancellationToken ct)
        => Map(await db.QuerySingleAsync($"SELECT {Columns} FROM Users WHERE Id = ?", userId));

    public async Task<AppUser?> FindByNameAsync(string normalizedUserName, CancellationToken ct)
        => Map(await db.QuerySingleAsync($"SELECT {Columns} FROM Users WHERE NormalizedUserName = ?", normalizedUserName));

    public Task<string> GetUserIdAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.Id);
    public Task<string?> GetUserNameAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.UserName);
    public Task SetUserNameAsync(AppUser user, string? userName, CancellationToken ct) { user.UserName = userName; return Task.CompletedTask; }
    public Task<string?> GetNormalizedUserNameAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.NormalizedUserName);
    public Task SetNormalizedUserNameAsync(AppUser user, string? normalizedName, CancellationToken ct) { user.NormalizedUserName = normalizedName; return Task.CompletedTask; }

    // ---- IUserPasswordStore --------------------------------------------------------------------

    public Task SetPasswordHashAsync(AppUser user, string? passwordHash, CancellationToken ct) { user.PasswordHash = passwordHash; return Task.CompletedTask; }
    public Task<string?> GetPasswordHashAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.PasswordHash);
    public Task<bool> HasPasswordAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.PasswordHash is not null);

    // ---- IUserEmailStore -----------------------------------------------------------------------

    public Task SetEmailAsync(AppUser user, string? email, CancellationToken ct) { user.Email = email; return Task.CompletedTask; }
    public Task<string?> GetEmailAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.Email);
    public Task<bool> GetEmailConfirmedAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.EmailConfirmed);
    public Task SetEmailConfirmedAsync(AppUser user, bool confirmed, CancellationToken ct) { user.EmailConfirmed = confirmed; return Task.CompletedTask; }
    public Task<string?> GetNormalizedEmailAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.NormalizedEmail);
    public Task SetNormalizedEmailAsync(AppUser user, string? normalizedEmail, CancellationToken ct) { user.NormalizedEmail = normalizedEmail; return Task.CompletedTask; }

    public async Task<AppUser?> FindByEmailAsync(string normalizedEmail, CancellationToken ct)
        => Map(await db.QuerySingleAsync($"SELECT {Columns} FROM Users WHERE NormalizedEmail = ? LIMIT 1", normalizedEmail));

    // ---- IUserSecurityStampStore ---------------------------------------------------------------

    public Task SetSecurityStampAsync(AppUser user, string stamp, CancellationToken ct) { user.SecurityStamp = stamp; return Task.CompletedTask; }
    public Task<string?> GetSecurityStampAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.SecurityStamp);

    // ---- IUserLockoutStore ---------------------------------------------------------------------

    public Task<DateTimeOffset?> GetLockoutEndDateAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.LockoutEnd);
    public Task SetLockoutEndDateAsync(AppUser user, DateTimeOffset? lockoutEnd, CancellationToken ct) { user.LockoutEnd = lockoutEnd; return Task.CompletedTask; }
    public Task<int> IncrementAccessFailedCountAsync(AppUser user, CancellationToken ct) => Task.FromResult(++user.AccessFailedCount);
    public Task ResetAccessFailedCountAsync(AppUser user, CancellationToken ct) { user.AccessFailedCount = 0; return Task.CompletedTask; }
    public Task<int> GetAccessFailedCountAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.AccessFailedCount);
    public Task<bool> GetLockoutEnabledAsync(AppUser user, CancellationToken ct) => Task.FromResult(user.LockoutEnabled);
    public Task SetLockoutEnabledAsync(AppUser user, bool enabled, CancellationToken ct) { user.LockoutEnabled = enabled; return Task.CompletedTask; }

    // ---- Mapping -------------------------------------------------------------------------------

    private static object?[] ToArgs(AppUser u, string? concurrencyStamp) =>
    [
        u.Id, u.UserName, u.NormalizedUserName, u.Email, u.NormalizedEmail, u.EmailConfirmed, u.PasswordHash, u.SecurityStamp,
        concurrencyStamp, u.LockoutEnd, u.LockoutEnabled, u.AccessFailedCount, u.DisplayName, u.Sex?.ToString(), u.BirthDate,
        u.HeightCm, u.WeightKg, u.ActivityLevel, u.WeightGoal, u.DailyCalorieGoal, u.ProteinGoalG, u.CarbsGoalG, u.FatGoalG,
        u.TimeZone, u.UseMetric, u.CreatedAt,
    ];

    private static AppUser? Map(DbRow? r)
    {
        if (r is null) return null;
        return new AppUser
        {
            Id = r.GetString("Id")!,
            UserName = r.GetString("UserName"),
            NormalizedUserName = r.GetString("NormalizedUserName"),
            Email = r.GetString("Email"),
            NormalizedEmail = r.GetString("NormalizedEmail"),
            EmailConfirmed = r.GetBoolean("EmailConfirmed"),
            PasswordHash = r.GetString("PasswordHash"),
            SecurityStamp = r.GetString("SecurityStamp"),
            ConcurrencyStamp = r.GetString("ConcurrencyStamp"),
            LockoutEnd = r.GetNullableDateTimeOffset("LockoutEnd"),
            LockoutEnabled = r.GetBoolean("LockoutEnabled"),
            AccessFailedCount = r.GetInt32("AccessFailedCount"),
            DisplayName = r.GetString("DisplayName"),
            Sex = Enum.TryParse<Sex>(r.GetString("Sex"), out var sex) ? sex : null,
            BirthDate = r.GetNullableDateOnly("BirthDate"),
            HeightCm = r.GetNullableDouble("HeightCm"),
            WeightKg = r.GetNullableDouble("WeightKg"),
            ActivityLevel = Enum.TryParse<ActivityLevel>(r.GetString("ActivityLevel"), out var a) ? a : ActivityLevel.Moderate,
            WeightGoal = Enum.TryParse<WeightGoal>(r.GetString("WeightGoal"), out var g) ? g : WeightGoal.Maintain,
            DailyCalorieGoal = r.GetInt32("DailyCalorieGoal"),
            ProteinGoalG = r.GetInt32("ProteinGoalG"),
            CarbsGoalG = r.GetInt32("CarbsGoalG"),
            FatGoalG = r.GetInt32("FatGoalG"),
            TimeZone = r.GetString("TimeZone") ?? "UTC",
            UseMetric = r.GetBoolean("UseMetric"),
            CreatedAt = r.GetNullableDateTimeOffset("CreatedAt") ?? DateTimeOffset.UtcNow,
        };
    }
}
