using CalorieCopilot.Data;
using CalorieCopilot.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace CalorieCopilot.Pages;

public class DiaryModel(UserManager<AppUser> userManager, FoodLogRepository foodLog) : PageModel
{
    public AppUser CurrentUser { get; private set; } = null!;
    public DateOnly Date { get; private set; }
    public DateOnly Today { get; private set; }
    public IReadOnlyList<FoodEntry> Entries { get; private set; } = [];
    public IReadOnlyList<RecentFood> RecentFoods { get; private set; } = [];

    [BindProperty]
    public EntryInput Input { get; set; } = new();

    /// <summary>Re-open the entry modal after a failed submission.</summary>
    public bool ShowModal { get; private set; }

    public double TotalCalories => Entries.Sum(e => e.TotalCalories);
    public double TotalProtein => Entries.Sum(e => e.TotalProtein);
    public double TotalCarbs => Entries.Sum(e => e.TotalCarbs);
    public double TotalFat => Entries.Sum(e => e.TotalFat);

    public IEnumerable<FoodEntry> EntriesFor(Meal meal) => Entries.Where(e => e.Meal == meal);

    public async Task<IActionResult> OnGetAsync(DateOnly? date)
    {
        if (!await LoadAsync(date)) return Challenge();
        Input = new EntryInput { Date = Date, Meal = DefaultMeal() };
        return Page();
    }

    public async Task<IActionResult> OnPostAddAsync()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Challenge();
        Input.Id = null;

        if (!ModelState.IsValid)
        {
            return await RedisplayAsync(Input.Date);
        }

        await foodLog.AddAsync(Input.ToEntry(user.Id));
        TempData["Success"] = $"Added {Input.Name.Trim()} to {Input.Meal.ToString().ToLowerInvariant()}.";
        return RedirectToPage(new { date = Input.Date.ToString("yyyy-MM-dd") });
    }

    public async Task<IActionResult> OnPostEditAsync()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Challenge();

        if (Input.Id is not { } id || await foodLog.GetEntryAsync(user.Id, id) is not { } existing)
        {
            TempData["Error"] = "That entry no longer exists.";
            return RedirectToPage(new { date = Input.Date.ToString("yyyy-MM-dd") });
        }

        if (!ModelState.IsValid)
        {
            return await RedisplayAsync(Input.Date);
        }

        var updated = Input.ToEntry(user.Id);
        updated.Barcode = existing.Barcode;
        await foodLog.UpdateAsync(updated);
        TempData["Success"] = $"Updated {updated.Name}.";
        return RedirectToPage(new { date = Input.Date.ToString("yyyy-MM-dd") });
    }

    public async Task<IActionResult> OnPostDeleteAsync(long id, DateOnly date)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Challenge();
        await foodLog.DeleteAsync(user.Id, id);
        TempData["Success"] = "Entry removed.";
        return RedirectToPage(new { date = date.ToString("yyyy-MM-dd") });
    }

    /// <summary>Copies all of yesterday's entries for one meal into the selected day.</summary>
    public async Task<IActionResult> OnPostCopyPreviousAsync(DateOnly date, Meal meal)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Challenge();

        var previous = (await foodLog.GetEntriesAsync(user.Id, date.AddDays(-1))).Where(e => e.Meal == meal).ToList();
        foreach (var e in previous)
        {
            e.EntryDate = date;
            await foodLog.AddAsync(e);
        }
        TempData[previous.Count > 0 ? "Success" : "Error"] = previous.Count > 0
            ? $"Copied {previous.Count} item(s) from yesterday's {meal.ToString().ToLowerInvariant()}."
            : $"Nothing logged for {meal.ToString().ToLowerInvariant()} yesterday.";
        return RedirectToPage(new { date = date.ToString("yyyy-MM-dd") });
    }

    private async Task<IActionResult> RedisplayAsync(DateOnly date)
    {
        if (!await LoadAsync(date)) return Challenge();
        ShowModal = true;
        return Page();
    }

    private async Task<bool> LoadAsync(DateOnly? date)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return false;
        CurrentUser = user;
        Today = user.Today();
        Date = date is { } d && d.Year is > 2000 and < 2200 ? d : Today;
        Entries = await foodLog.GetEntriesAsync(user.Id, Date);
        RecentFoods = await foodLog.GetRecentFoodsAsync(user.Id);
        return true;
    }

    private Meal DefaultMeal()
    {
        if (Date != Today) return Meal.Breakfast;
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(CurrentUser.TimeZone); }
        catch (Exception) { tz = TimeZoneInfo.Utc; }
        return EntryInput.GuessMeal(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz));
    }
}
