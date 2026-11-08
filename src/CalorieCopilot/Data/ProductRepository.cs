using CalorieCopilot.Models;

namespace CalorieCopilot.Data;

/// <summary>
/// Barcode → product cache. Rows with an empty <c>OwnerId</c> come from Open Food Facts and are shared;
/// rows with an <c>OwnerId</c> are a user's own entries for products the public database doesn't know.
/// </summary>
public sealed class ProductRepository(IDatabase db)
{
    private const string Columns =
        "Barcode, OwnerId, Name, Brand, ServingDescription, ServingGrams, CaloriesPer100g, ProteinPer100g, CarbsPer100g, FatPer100g, " +
        "CaloriesPerServing, ProteinPerServing, CarbsPerServing, FatPerServing, ImageUrl, Source, UpdatedAt";

    /// <summary>Finds a product, preferring the user's own version over the shared one.</summary>
    public async Task<Product?> FindAsync(string barcode, string userId)
        => await db.QuerySingleAsync(
                $"SELECT {Columns} FROM Products WHERE Barcode = ? AND OwnerId IN ('', ?) ORDER BY OwnerId DESC LIMIT 1", barcode, userId) is { } r
            ? Map(r)
            : null;

    public Task UpsertAsync(Product p) => db.ExecuteAsync(
        $"INSERT INTO Products ({Columns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT (Barcode, OwnerId) DO UPDATE SET Name = excluded.Name, Brand = excluded.Brand, ServingDescription = excluded.ServingDescription, " +
        "ServingGrams = excluded.ServingGrams, CaloriesPer100g = excluded.CaloriesPer100g, ProteinPer100g = excluded.ProteinPer100g, " +
        "CarbsPer100g = excluded.CarbsPer100g, FatPer100g = excluded.FatPer100g, CaloriesPerServing = excluded.CaloriesPerServing, " +
        "ProteinPerServing = excluded.ProteinPerServing, CarbsPerServing = excluded.CarbsPerServing, FatPerServing = excluded.FatPerServing, " +
        "ImageUrl = excluded.ImageUrl, Source = excluded.Source, UpdatedAt = excluded.UpdatedAt",
        p.Barcode, p.OwnerId, p.Name, p.Brand, p.ServingDescription, p.ServingGrams, p.CaloriesPer100g, p.ProteinPer100g, p.CarbsPer100g,
        p.FatPer100g, p.CaloriesPerServing, p.ProteinPerServing, p.CarbsPerServing, p.FatPerServing, p.ImageUrl, p.Source, DateTimeOffset.UtcNow);

    private static Product Map(DbRow r) => new()
    {
        Barcode = r.GetString("Barcode")!,
        OwnerId = r.GetString("OwnerId") ?? "",
        Name = r.GetString("Name")!,
        Brand = r.GetString("Brand"),
        ServingDescription = r.GetString("ServingDescription"),
        ServingGrams = r.GetNullableDouble("ServingGrams"),
        CaloriesPer100g = r.GetNullableDouble("CaloriesPer100g"),
        ProteinPer100g = r.GetNullableDouble("ProteinPer100g"),
        CarbsPer100g = r.GetNullableDouble("CarbsPer100g"),
        FatPer100g = r.GetNullableDouble("FatPer100g"),
        CaloriesPerServing = r.GetNullableDouble("CaloriesPerServing"),
        ProteinPerServing = r.GetNullableDouble("ProteinPerServing"),
        CarbsPerServing = r.GetNullableDouble("CarbsPerServing"),
        FatPerServing = r.GetNullableDouble("FatPerServing"),
        ImageUrl = r.GetString("ImageUrl"),
        Source = r.GetString("Source") ?? "",
        UpdatedAt = r.GetNullableDateTimeOffset("UpdatedAt") ?? DateTimeOffset.MinValue,
    };
}
