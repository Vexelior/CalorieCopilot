using Microsoft.AspNetCore.Identity;

namespace CalorieCopilot.Models;

public enum Sex { Male, Female }

public enum ActivityLevel { Sedentary, Light, Moderate, Active, VeryActive }

public enum WeightGoal { Lose, Maintain, Gain }

/// <summary>ASP.NET Identity user with nutrition profile fields.</summary>
public class AppUser : IdentityUser
{
    public string? DisplayName { get; set; }
    public Sex? Sex { get; set; }
    public DateOnly? BirthDate { get; set; }
    public double? HeightCm { get; set; }
    public double? WeightKg { get; set; }
    public ActivityLevel ActivityLevel { get; set; } = ActivityLevel.Moderate;
    public WeightGoal WeightGoal { get; set; } = WeightGoal.Maintain;
    public int DailyCalorieGoal { get; set; } = 2000;
    public int ProteinGoalG { get; set; } = 150;
    public int CarbsGoalG { get; set; } = 200;
    public int FatGoalG { get; set; } = 67;
    public string TimeZone { get; set; } = "UTC";
    public bool UseMetric { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public string FriendlyName => string.IsNullOrWhiteSpace(DisplayName) ? (Email ?? UserName ?? "there") : DisplayName!;

    public int? AgeOn(DateOnly date)
    {
        if (BirthDate is not { } b) return null;
        var age = date.Year - b.Year;
        if (date < b.AddYears(age)) age--;
        return age;
    }

    /// <summary>"Today" in the user's own time zone.</summary>
    public DateOnly Today()
    {
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(TimeZone); }
        catch (Exception) { tz = TimeZoneInfo.Utc; }
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz).DateTime);
    }
}
