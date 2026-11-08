using CalorieCopilot.Data;
using CalorieCopilot.Models;

namespace CalorieCopilot.Services;

/// <summary>Resolves barcodes: local cache / user products first, then Open Food Facts (result cached).</summary>
public sealed class ProductLookupService(ProductRepository products, OpenFoodFactsClient off)
{
    public static bool IsValidBarcode(string? code) =>
        code is { Length: >= 6 and <= 14 } && code.All(char.IsAsciiDigit);

    public async Task<Product?> LookupAsync(string barcode, string userId, CancellationToken ct = default)
    {
        var cached = await products.FindAsync(barcode, userId);
        if (cached is not null && (cached.OwnerId != "" || cached.UpdatedAt > DateTimeOffset.UtcNow.AddDays(-30)))
        {
            return cached;
        }

        var remote = await off.GetProductAsync(barcode, ct);
        if (remote is null)
        {
            return cached; // stale cache is better than nothing
        }

        await products.UpsertAsync(remote);
        remote.UpdatedAt = DateTimeOffset.UtcNow;
        return remote;
    }
}
