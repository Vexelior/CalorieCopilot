using System.ComponentModel.DataAnnotations;

namespace CalorieCopilot.Models;

/// <summary>Form model for adding/editing a diary entry (diary modal and barcode scanner).</summary>
public sealed class EntryInput
{
    public long? Id { get; set; }

    [Required]
    public DateOnly Date { get; set; }

    public Meal Meal { get; set; } = Meal.Breakfast;

    [Required, StringLength(120)]
    public string Name { get; set; } = "";

    [StringLength(80)]
    public string? Brand { get; set; }

    [RegularExpression(@"^\d{6,14}$", ErrorMessage = "Barcodes must be 6-14 digits.")]
    public string? Barcode { get; set; }

    [StringLength(60), Display(Name = "Serving size")]
    public string? ServingDescription { get; set; }

    [Range(0.01, 100)]
    public double Servings { get; set; } = 1;

    [Range(0, 10000), Display(Name = "Calories (kcal)")]
    public double Calories { get; set; }

    [Range(0, 1000), Display(Name = "Protein (g)")]
    public double? ProteinG { get; set; }

    [Range(0, 1000), Display(Name = "Carbs (g)")]
    public double? CarbsG { get; set; }

    [Range(0, 1000), Display(Name = "Fat (g)")]
    public double? FatG { get; set; }

    public FoodEntry ToEntry(string userId) => new()
    {
        Id = Id ?? 0,
        UserId = userId,
        EntryDate = Date,
        Meal = Meal,
        Name = Name.Trim(),
        Brand = string.IsNullOrWhiteSpace(Brand) ? null : Brand.Trim(),
        Barcode = string.IsNullOrWhiteSpace(Barcode) ? null : Barcode.Trim(),
        ServingDescription = string.IsNullOrWhiteSpace(ServingDescription) ? null : ServingDescription.Trim(),
        Servings = Math.Round(Servings, 2),
        Calories = Math.Round(Calories, 1),
        ProteinG = Math.Round(ProteinG ?? 0, 1),
        CarbsG = Math.Round(CarbsG ?? 0, 1),
        FatG = Math.Round(FatG ?? 0, 1),
    };

    public static Meal GuessMeal(DateTimeOffset localNow) => localNow.Hour switch
    {
        < 11 => Meal.Breakfast,
        < 15 => Meal.Lunch,
        < 21 => Meal.Dinner,
        _ => Meal.Snack,
    };
}
