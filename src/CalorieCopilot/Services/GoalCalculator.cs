using CalorieCopilot.Models;

namespace CalorieCopilot.Services;

public sealed record GoalSuggestion(int Bmr, int Tdee, int Calories, int ProteinG, int CarbsG, int FatG);

/// <summary>Suggests daily targets using the Mifflin-St Jeor equation.</summary>
public static class GoalCalculator
{
    public static GoalSuggestion? Suggest(AppUser user, DateOnly today)
    {
        if (user.Sex is not { } sex || user.HeightCm is not { } h || user.WeightKg is not { } w || user.AgeOn(today) is not { } age)
        {
            return null;
        }

        var bmr = 10 * w + 6.25 * h - 5 * age + (sex == Sex.Male ? 5 : -161);
        var factor = user.ActivityLevel switch
        {
            ActivityLevel.Sedentary => 1.2,
            ActivityLevel.Light => 1.375,
            ActivityLevel.Moderate => 1.55,
            ActivityLevel.Active => 1.725,
            ActivityLevel.VeryActive => 1.9,
            _ => 1.55,
        };
        var tdee = bmr * factor;
        var calories = user.WeightGoal switch
        {
            WeightGoal.Lose => tdee - 500,
            WeightGoal.Gain => tdee + 300,
            _ => tdee,
        };
        calories = Math.Max(calories, sex == Sex.Male ? 1500 : 1200);

        // Protein ~1.8 g/kg, fat 27.5% of energy, remainder carbs.
        var protein = 1.8 * w;
        var fat = calories * 0.275 / 9;
        var carbs = Math.Max(0, (calories - protein * 4 - fat * 9) / 4);

        return new GoalSuggestion((int)Math.Round(bmr), (int)Math.Round(tdee), RoundTo(calories, 10),
            (int)Math.Round(protein), (int)Math.Round(carbs), (int)Math.Round(fat));
    }

    private static int RoundTo(double value, int step) => (int)(Math.Round(value / step) * step);
}
