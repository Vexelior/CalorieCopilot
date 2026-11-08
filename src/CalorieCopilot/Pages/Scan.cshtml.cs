using CalorieCopilot.Data;
using CalorieCopilot.Models;
using CalorieCopilot.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace CalorieCopilot.Pages;

public class ScanModel(UserManager<AppUser> userManager, FoodLogRepository foodLog, ProductRepository products) : PageModel
{
    [BindProperty]
    public EntryInput Input { get; set; } = new();

    /// <summary>Remember a product the public database didn't know, so the next scan is instant.</summary>
    [BindProperty]
    public bool SaveProduct { get; set; } = true;

    public DateOnly Today { get; private set; }

    public async Task<IActionResult> OnGetAsync(DateOnly? date, Meal? meal)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Challenge();
        Today = user.Today();
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(user.TimeZone); }
        catch (Exception) { tz = TimeZoneInfo.Utc; }
        Input = new EntryInput
        {
            Date = date ?? Today,
            Meal = meal ?? EntryInput.GuessMeal(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz)),
        };
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Challenge();
        Today = user.Today();
        Input.Id = null;

        if (!ModelState.IsValid)
        {
            TempData["Error"] = string.Join(" ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage));
            return Page();
        }

        var entry = Input.ToEntry(user.Id);
        if (SaveProduct && ProductLookupService.IsValidBarcode(entry.Barcode))
        {
            var existing = await products.FindAsync(entry.Barcode!, user.Id);
            if (existing is null)
            {
                await products.UpsertAsync(new Product
                {
                    Barcode = entry.Barcode!,
                    OwnerId = user.Id,
                    Name = entry.Name,
                    Brand = entry.Brand,
                    ServingDescription = entry.ServingDescription,
                    CaloriesPerServing = entry.Calories,
                    ProteinPerServing = entry.ProteinG,
                    CarbsPerServing = entry.CarbsG,
                    FatPerServing = entry.FatG,
                    Source = "user",
                });
            }
        }

        await foodLog.AddAsync(entry);
        TempData["Success"] = $"Added {entry.Name} ({entry.TotalCalories:N0} kcal) to {entry.Meal.ToString().ToLowerInvariant()}.";
        return RedirectToPage("/Diary", new { date = entry.EntryDate.ToString("yyyy-MM-dd") });
    }
}
