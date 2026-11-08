using System.Globalization;
using System.Text.Json;
using CalorieCopilot.Models;

namespace CalorieCopilot.Services;

/// <summary>Looks up packaged foods by barcode in the free Open Food Facts database.</summary>
public sealed class OpenFoodFactsClient(HttpClient http, ILogger<OpenFoodFactsClient> logger)
{
    private const string Fields = "code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments,image_front_small_url";

    public async Task<Product?> GetProductAsync(string barcode, CancellationToken ct = default)
    {
        try
        {
            using var response = await http.GetAsync($"api/v2/product/{Uri.EscapeDataString(barcode)}.json?fields={Fields}", ct);
            if (!response.IsSuccessStatusCode)
            {
                return null; // 404 means "product not found"
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            return Parse(barcode, doc.RootElement);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogWarning(ex, "Open Food Facts lookup failed for {Barcode}", barcode);
            return null;
        }
    }

    internal static Product? Parse(string barcode, JsonElement root)
    {
        if (!root.TryGetProperty("product", out var p) || p.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var name = Str(p, "product_name") ?? Str(p, "generic_name");
        if (string.IsNullOrWhiteSpace(name))
        {
            return null;
        }

        p.TryGetProperty("nutriments", out var n);
        var kcal100 = Num(n, "energy-kcal_100g") ?? KjToKcal(Num(n, "energy_100g"));
        var kcalServing = Num(n, "energy-kcal_serving") ?? KjToKcal(Num(n, "energy_serving"));

        return new Product
        {
            Barcode = barcode,
            Name = name.Trim(),
            Brand = Str(p, "brands")?.Split(',')[0].Trim(),
            ServingDescription = Str(p, "serving_size"),
            ServingGrams = Num(p, "serving_quantity") is > 0 and var g ? g : null,
            CaloriesPer100g = kcal100,
            ProteinPer100g = Num(n, "proteins_100g"),
            CarbsPer100g = Num(n, "carbohydrates_100g"),
            FatPer100g = Num(n, "fat_100g"),
            CaloriesPerServing = kcalServing,
            ProteinPerServing = Num(n, "proteins_serving"),
            CarbsPerServing = Num(n, "carbohydrates_serving"),
            FatPerServing = Num(n, "fat_serving"),
            ImageUrl = Str(p, "image_front_small_url"),
            Source = "openfoodfacts",
        };
    }

    private static double? KjToKcal(double? kj) => kj is { } v ? Math.Round(v / 4.184, 1) : null;

    private static string? Str(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString())
            ? v.GetString()
            : null;

    private static double? Num(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.Number => v.GetDouble(),
            JsonValueKind.String when double.TryParse(v.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var d) => d,
            _ => null,
        };
    }
}
