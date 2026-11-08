namespace CalorieCopilot.Models;

public enum Meal { Breakfast, Lunch, Dinner, Snack }

public sealed class FoodEntry
{
    public long Id { get; set; }
    public string UserId { get; set; } = "";
    public DateOnly EntryDate { get; set; }
    public Meal Meal { get; set; }
    public string Name { get; set; } = "";
    public string? Brand { get; set; }
    public string? Barcode { get; set; }
    public string? ServingDescription { get; set; }
    public double Servings { get; set; } = 1;

    /// <summary>Nutrition values are per single serving.</summary>
    public double Calories { get; set; }
    public double ProteinG { get; set; }
    public double CarbsG { get; set; }
    public double FatG { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public double TotalCalories => Calories * Servings;
    public double TotalProtein => ProteinG * Servings;
    public double TotalCarbs => CarbsG * Servings;
    public double TotalFat => FatG * Servings;
}

public sealed class Product
{
    public string Barcode { get; set; } = "";
    public string OwnerId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Brand { get; set; }
    public string? ServingDescription { get; set; }
    public double? ServingGrams { get; set; }
    public double? CaloriesPer100g { get; set; }
    public double? ProteinPer100g { get; set; }
    public double? CarbsPer100g { get; set; }
    public double? FatPer100g { get; set; }
    public double? CaloriesPerServing { get; set; }
    public double? ProteinPerServing { get; set; }
    public double? CarbsPerServing { get; set; }
    public double? FatPerServing { get; set; }
    public string? ImageUrl { get; set; }
    public string Source { get; set; } = "";
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed record DailyTotals(DateOnly Date, double Calories, double ProteinG, double CarbsG, double FatG, int EntryCount);

public sealed record WeightLog(DateOnly Date, double WeightKg);

public sealed record RecentFood(string Name, string? Brand, string? Barcode, string? ServingDescription, double Calories, double ProteinG, double CarbsG, double FatG, int TimesLogged);

public sealed record TopFood(string Name, string? Brand, int TimesLogged, double TotalCalories);
