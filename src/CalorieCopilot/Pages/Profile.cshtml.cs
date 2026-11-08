using System.ComponentModel.DataAnnotations;
using CalorieCopilot.Data;
using CalorieCopilot.Models;
using CalorieCopilot.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace CalorieCopilot.Pages;

public class ProfileModel(UserManager<AppUser> userManager, SignInManager<AppUser> signInManager, WeightRepository weights, ILogger<ProfileModel> logger) : PageModel
{
    private const double CmPerInch = 2.54;

    public AppUser CurrentUser { get; private set; } = null!;
    public GoalSuggestion? Suggestion { get; private set; }
    public IReadOnlyList<string> TimeZones { get; } = TimeZoneInfo.GetSystemTimeZones().Select(t => t.Id).Order().ToList();

    public AccountInput Account { get; set; } = new();
    public BodyInput Body { get; set; } = new();
    public TargetsInput Targets { get; set; } = new();
    public PasswordInput Password { get; set; } = new();

    /// <summary>Which section had a validation error, so the right fields show it.</summary>
    public string? ActiveSection { get; private set; }

    public sealed class AccountInput
    {
        [Required, StringLength(50), Display(Name = "Display name")]
        public string DisplayName { get; set; } = "";

        [Required, EmailAddress, StringLength(254)]
        public string Email { get; set; } = "";

        [Required, Display(Name = "Time zone")]
        public string TimeZone { get; set; } = "UTC";

        [Display(Name = "Units")]
        public bool UseMetric { get; set; } = true;
    }

    public sealed class BodyInput
    {
        public Sex? Sex { get; set; }

        [DataType(DataType.Date), Display(Name = "Date of birth")]
        public DateOnly? BirthDate { get; set; }

        [Range(50, 260), Display(Name = "Height (cm)")]
        public double? HeightCm { get; set; }

        [Range(2, 8), Display(Name = "Height (ft)")]
        public int? HeightFt { get; set; }

        [Range(0, 11.9), Display(Name = "Height (in)")]
        public double? HeightIn { get; set; }

        [Range(20, 1000), Display(Name = "Weight")]
        public double? Weight { get; set; }

        [Display(Name = "Activity level")]
        public ActivityLevel ActivityLevel { get; set; } = ActivityLevel.Moderate;

        [Display(Name = "Goal")]
        public WeightGoal WeightGoal { get; set; } = WeightGoal.Maintain;
    }

    public sealed class TargetsInput
    {
        [Range(800, 10000), Display(Name = "Daily calories")]
        public int DailyCalorieGoal { get; set; }

        [Range(0, 1000), Display(Name = "Protein (g)")]
        public int ProteinGoalG { get; set; }

        [Range(0, 2000), Display(Name = "Carbs (g)")]
        public int CarbsGoalG { get; set; }

        [Range(0, 1000), Display(Name = "Fat (g)")]
        public int FatGoalG { get; set; }
    }

    public sealed class PasswordInput
    {
        [Required, DataType(DataType.Password), Display(Name = "Current password")]
        public string CurrentPassword { get; set; } = "";

        [Required, StringLength(100, MinimumLength = 8), DataType(DataType.Password), Display(Name = "New password")]
        public string NewPassword { get; set; } = "";

        [Required, DataType(DataType.Password), Display(Name = "Confirm new password")]
        [Compare(nameof(NewPassword), ErrorMessage = "The passwords do not match.")]
        public string ConfirmPassword { get; set; } = "";
    }

    public static string Describe(ActivityLevel a) => a switch
    {
        ActivityLevel.Sedentary => "Sedentary (little or no exercise)",
        ActivityLevel.Light => "Light (exercise 1-3 days/week)",
        ActivityLevel.Moderate => "Moderate (exercise 3-5 days/week)",
        ActivityLevel.Active => "Active (exercise 6-7 days/week)",
        ActivityLevel.VeryActive => "Very active (physical job or 2x/day)",
        _ => a.ToString(),
    };

    public static string Describe(WeightGoal g) => g switch
    {
        WeightGoal.Lose => "Lose weight (about 0.5 kg / 1 lb per week)",
        WeightGoal.Maintain => "Maintain weight",
        WeightGoal.Gain => "Gain weight (lean bulk)",
        _ => g.ToString(),
    };

    public async Task<IActionResult> OnGetAsync()
    {
        if (!await LoadAsync()) return Challenge();
        return Page();
    }

    public async Task<IActionResult> OnPostAccountAsync([Bind(Prefix = "Account")] AccountInput input)
    {
        if (!await LoadAsync()) return Challenge();
        if (!TryValidate(input, "Account")) { Account = input; return Page(); }

        if (!IsKnownTimeZone(input.TimeZone))
        {
            ModelState.AddModelError("Account.TimeZone", "Unknown time zone.");
            Account = input; ActiveSection = "Account";
            return Page();
        }

        var user = CurrentUser;
        var email = input.Email.Trim();
        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            var setName = await userManager.SetUserNameAsync(user, email);
            var setEmail = setName.Succeeded ? await userManager.SetEmailAsync(user, email) : setName;
            if (!setEmail.Succeeded)
            {
                ModelState.AddModelError("Account.Email", "That email is already in use.");
                await LoadAsync(); // discard in-memory changes to the user
                Account = input; ActiveSection = "Account";
                return Page();
            }
        }

        user.DisplayName = input.DisplayName.Trim();
        user.TimeZone = input.TimeZone;
        user.UseMetric = input.UseMetric;
        return await SaveAsync(user, "Account settings saved.");
    }

    public async Task<IActionResult> OnPostBodyAsync([Bind(Prefix = "Body")] BodyInput input)
    {
        if (!await LoadAsync()) return Challenge();
        if (!TryValidate(input, "Body")) { Body = input; return Page(); }

        var user = CurrentUser;
        var today = user.Today();
        if (input.BirthDate is { } b && (b > today || b < today.AddYears(-120)))
        {
            ModelState.AddModelError("Body.BirthDate", "Please enter a valid date of birth.");
            Body = input; ActiveSection = "Body";
            return Page();
        }

        user.Sex = input.Sex;
        user.BirthDate = input.BirthDate;
        user.ActivityLevel = input.ActivityLevel;
        user.WeightGoal = input.WeightGoal;
        user.HeightCm = user.UseMetric
            ? input.HeightCm
            : input.HeightFt is { } ft ? Math.Round((ft * 12 + (input.HeightIn ?? 0)) * CmPerInch, 1) : null;

        double? newWeightKg = input.Weight is { } w ? Math.Round(user.UseMetric ? w : w * AnalyticsModel.KgPerLb, 2) : null;
        if (newWeightKg is { } kg && (user.WeightKg is null || Math.Abs(user.WeightKg.Value - kg) > 0.001))
        {
            await weights.UpsertAsync(user.Id, today, kg);
        }
        user.WeightKg = newWeightKg;
        return await SaveAsync(user, "Body details saved.");
    }

    public async Task<IActionResult> OnPostTargetsAsync([Bind(Prefix = "Targets")] TargetsInput input)
    {
        if (!await LoadAsync()) return Challenge();
        if (!TryValidate(input, "Targets")) { Targets = input; return Page(); }

        var user = CurrentUser;
        user.DailyCalorieGoal = input.DailyCalorieGoal;
        user.ProteinGoalG = input.ProteinGoalG;
        user.CarbsGoalG = input.CarbsGoalG;
        user.FatGoalG = input.FatGoalG;
        return await SaveAsync(user, "Daily targets saved.");
    }

    public async Task<IActionResult> OnPostApplySuggestionAsync()
    {
        if (!await LoadAsync()) return Challenge();
        if (Suggestion is not { } s)
        {
            TempData["Error"] = "Fill in your sex, date of birth, height and weight to get suggested targets.";
            return RedirectToPage();
        }

        var user = CurrentUser;
        user.DailyCalorieGoal = s.Calories;
        user.ProteinGoalG = s.ProteinG;
        user.CarbsGoalG = s.CarbsG;
        user.FatGoalG = s.FatG;
        return await SaveAsync(user, $"Targets updated to {s.Calories:N0} kcal per day.");
    }

    public async Task<IActionResult> OnPostPasswordAsync([Bind(Prefix = "Password")] PasswordInput input)
    {
        if (!await LoadAsync()) return Challenge();
        if (!TryValidate(input, "Password")) return Page();

        var result = await userManager.ChangePasswordAsync(CurrentUser, input.CurrentPassword, input.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var e in result.Errors)
            {
                ModelState.AddModelError(e.Code == "PasswordMismatch" ? "Password.CurrentPassword" : "Password.NewPassword",
                    e.Code == "PasswordMismatch" ? "Your current password is incorrect." : e.Description);
            }
            ActiveSection = "Password";
            await LoadAsync();
            return Page();
        }

        await signInManager.RefreshSignInAsync(CurrentUser);
        TempData["Success"] = "Your password has been changed.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteAsync(string deletePassword)
    {
        if (!await LoadAsync()) return Challenge();
        if (string.IsNullOrEmpty(deletePassword) || !await userManager.CheckPasswordAsync(CurrentUser, deletePassword))
        {
            TempData["Error"] = "Incorrect password. Your account was not deleted.";
            return RedirectToPage();
        }

        await userManager.DeleteAsync(CurrentUser);
        await signInManager.SignOutAsync();
        logger.LogInformation("User deleted their account.");
        TempData["Success"] = "Your account and all of its data have been deleted.";
        return RedirectToPage("/Index");
    }

    private bool TryValidate(object input, string prefix)
    {
        // Only the submitted form's fields are bound; drop errors from the page-level properties.
        foreach (var key in ModelState.Keys.Where(k => !k.StartsWith(prefix + ".", StringComparison.Ordinal)).ToList())
        {
            ModelState.Remove(key);
        }
        if (ModelState.IsValid) return true;
        ActiveSection = prefix;
        return false;
    }

    private async Task<IActionResult> SaveAsync(AppUser user, string message)
    {
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            TempData["Error"] = string.Join(" ", result.Errors.Select(e => e.Description));
            return RedirectToPage();
        }
        await signInManager.RefreshSignInAsync(user);
        TempData["Success"] = message;
        return RedirectToPage();
    }

    private async Task<bool> LoadAsync()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return false;
        CurrentUser = user;
        Suggestion = GoalCalculator.Suggest(user, user.Today());

        Account = new AccountInput { DisplayName = user.DisplayName ?? "", Email = user.Email ?? "", TimeZone = user.TimeZone, UseMetric = user.UseMetric };
        var totalInches = user.HeightCm is { } cm ? cm / CmPerInch : (double?)null;
        Body = new BodyInput
        {
            Sex = user.Sex,
            BirthDate = user.BirthDate,
            HeightCm = user.HeightCm,
            HeightFt = totalInches is { } ti ? (int)(ti / 12) : null,
            HeightIn = totalInches is { } ti2 ? Math.Round(ti2 % 12, 1) : null,
            Weight = user.WeightKg is { } kg ? Math.Round(user.UseMetric ? kg : kg / AnalyticsModel.KgPerLb, 1) : null,
            ActivityLevel = user.ActivityLevel,
            WeightGoal = user.WeightGoal,
        };
        Targets = new TargetsInput { DailyCalorieGoal = user.DailyCalorieGoal, ProteinGoalG = user.ProteinGoalG, CarbsGoalG = user.CarbsGoalG, FatGoalG = user.FatGoalG };
        return true;
    }

    private static bool IsKnownTimeZone(string id) => CalorieCopilot.Pages.Account.RegisterModel.IsKnownTimeZone(id);
}
