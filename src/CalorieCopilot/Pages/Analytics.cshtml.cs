using System.ComponentModel.DataAnnotations;
using CalorieCopilot.Data;
using CalorieCopilot.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace CalorieCopilot.Pages;

public class AnalyticsModel(UserManager<AppUser> userManager, FoodLogRepository foodLog, WeightRepository weights) : PageModel
{
    public static readonly int[] Ranges = [7, 30, 90];
    public const double KgPerLb = 0.45359237;

    public AppUser CurrentUser { get; private set; } = null!;
    public int Days { get; private set; }
    public DateOnly From { get; private set; }
    public DateOnly To { get; private set; }
    public IReadOnlyList<DailyTotals> Daily { get; private set; } = [];
    public IReadOnlyDictionary<Meal, double> ByMeal { get; private set; } = new Dictionary<Meal, double>();
    public IReadOnlyList<TopFood> TopFoods { get; private set; } = [];
    public IReadOnlyList<WeightLog> Weights { get; private set; } = [];
    public int Streak { get; private set; }

    public IReadOnlyList<DailyTotals> LoggedDays => Daily.Where(d => d.EntryCount > 0).ToList();
    public double AverageCalories => LoggedDays.Count == 0 ? 0 : LoggedDays.Average(d => d.Calories);
    public double AverageProtein => LoggedDays.Count == 0 ? 0 : LoggedDays.Average(d => d.ProteinG);
    public double AverageCarbs => LoggedDays.Count == 0 ? 0 : LoggedDays.Average(d => d.CarbsG);
    public double AverageFat => LoggedDays.Count == 0 ? 0 : LoggedDays.Average(d => d.FatG);

    /// <summary>Logged days within ±10% of the calorie goal.</summary>
    public int DaysOnTarget => LoggedDays.Count(d => Math.Abs(d.Calories - CurrentUser.DailyCalorieGoal) <= CurrentUser.DailyCalorieGoal * 0.10);

    public double? WeightChange => Weights.Count >= 2 ? Weights[^1].WeightKg - Weights[0].WeightKg : null;

    public string WeightUnit => CurrentUser.UseMetric ? "kg" : "lb";
    public double ToDisplayWeight(double kg) => CurrentUser.UseMetric ? kg : kg / KgPerLb;

    [BindProperty, Range(20, 1000), Display(Name = "Weight")]
    public double? LogWeight { get; set; }

    public async Task<IActionResult> OnGetAsync(int days = 30)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Challenge();
        await LoadAsync(user, days);
        return Page();
    }

    public async Task<IActionResult> OnPostLogWeightAsync(int days = 30)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Challenge();

        if (!ModelState.IsValid || LogWeight is not { } value)
        {
            TempData["Error"] = "Please enter a valid weight.";
            return RedirectToPage(new { days });
        }

        var kg = Math.Round(user.UseMetric ? value : value * KgPerLb, 2);
        await weights.UpsertAsync(user.Id, user.Today(), kg);
        user.WeightKg = kg;
        await userManager.UpdateAsync(user);
        TempData["Success"] = $"Logged today's weight: {value:0.#} {(user.UseMetric ? "kg" : "lb")}.";
        return RedirectToPage(new { days });
    }

    private async Task LoadAsync(AppUser user, int days)
    {
        CurrentUser = user;
        Days = Ranges.Contains(days) ? days : 30;
        To = user.Today();
        From = To.AddDays(-(Days - 1));
        Daily = await foodLog.GetDailyTotalsAsync(user.Id, From, To);
        ByMeal = await foodLog.GetCaloriesByMealAsync(user.Id, From, To);
        TopFoods = await foodLog.GetTopFoodsAsync(user.Id, From, To);
        Weights = await weights.GetRangeAsync(user.Id, From, To);
        Streak = await foodLog.GetStreakAsync(user.Id, To);
    }
}
