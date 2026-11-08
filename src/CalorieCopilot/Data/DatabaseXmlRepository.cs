using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection.Repositories;

namespace CalorieCopilot.Data;

/// <summary>
/// Persists ASP.NET Core Data Protection keys in the database so auth cookies survive restarts
/// and work across multiple instances (important for stateless/serverless hosting with Turso).
/// </summary>
public sealed class DatabaseXmlRepository(IDatabase db) : IXmlRepository
{
    public IReadOnlyCollection<XElement> GetAllElements() =>
        db.QueryAsync("SELECT Xml FROM DataProtectionKeys").GetAwaiter().GetResult()
            .Select(r => XElement.Parse(r.GetString("Xml")!))
            .ToList();

    public void StoreElement(XElement element, string friendlyName) =>
        db.ExecuteAsync(
            "INSERT INTO DataProtectionKeys (FriendlyName, Xml, CreatedAt) VALUES (?, ?, ?) ON CONFLICT (FriendlyName) DO UPDATE SET Xml = excluded.Xml",
            friendlyName, element.ToString(SaveOptions.DisableFormatting), DateTimeOffset.UtcNow).GetAwaiter().GetResult();
}
