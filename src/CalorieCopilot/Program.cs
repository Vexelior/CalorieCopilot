using System.Security.Claims;
using CalorieCopilot.Data;
using CalorieCopilot.Identity;
using CalorieCopilot.Models;
using CalorieCopilot.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// ---- Database (Turso, or local SQLite when no Turso URL is configured) ----------------------------
builder.Services.Configure<DatabaseOptions>(builder.Configuration.GetSection(DatabaseOptions.SectionName));
var dbOptions = builder.Configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>() ?? new DatabaseOptions();
if (dbOptions.UseTurso)
{
    builder.Services.AddHttpClient(TursoDatabase.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(30));
    builder.Services.AddSingleton<IDatabase, TursoDatabase>();
}
else
{
    builder.Services.AddSingleton<IDatabase, SqliteDatabase>();
}
builder.Services.AddHostedService<DatabaseInitializer>();
builder.Services.AddSingleton<FoodLogRepository>();
builder.Services.AddSingleton<WeightRepository>();
builder.Services.AddSingleton<ProductRepository>();

// ---- Barcode lookup --------------------------------------------------------------------------------
builder.Services.AddHttpClient<OpenFoodFactsClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["OpenFoodFacts:BaseUrl"] ?? "https://world.openfoodfacts.org/");
    c.Timeout = TimeSpan.FromSeconds(10);
    c.DefaultRequestHeaders.UserAgent.ParseAdd("CalorieCopilot/1.0 (+https://github.com/vexelior/caloriecopilot)");
});
builder.Services.AddScoped<ProductLookupService>();

// ---- ASP.NET Core Identity -------------------------------------------------------------------------
builder.Services.AddDataProtection().SetApplicationName("CalorieCopilot");
builder.Services.AddSingleton<IConfigureOptions<KeyManagementOptions>>(sp =>
    new ConfigureOptions<KeyManagementOptions>(o => o.XmlRepository = new DatabaseXmlRepository(sp.GetRequiredService<IDatabase>())));

builder.Services
    .AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddIdentityCookies();

builder.Services
    .AddIdentityCore<AppUser>(o =>
    {
        o.User.RequireUniqueEmail = true;
        o.Password.RequiredLength = 8;
        o.Password.RequireNonAlphanumeric = false;
        o.Lockout.MaxFailedAccessAttempts = 5;
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
        o.SignIn.RequireConfirmedAccount = false;
    })
    .AddUserStore<DatabaseUserStore>()
    .AddSignInManager();

builder.Services.ConfigureApplicationCookie(o =>
{
    o.LoginPath = "/Account/Login";
    o.LogoutPath = "/Account/Logout";
    o.AccessDeniedPath = "/Account/Login";
    o.ExpireTimeSpan = TimeSpan.FromDays(30);
    o.SlidingExpiration = true;
    o.Cookie.HttpOnly = true;
    o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    // API calls get a 401 instead of an HTML redirect to the login page.
    o.Events.OnRedirectToLogin = ctx =>
    {
        if (ctx.Request.Path.StartsWithSegments("/api"))
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        }
        ctx.Response.Redirect(ctx.RedirectUri);
        return Task.CompletedTask;
    };
});

builder.Services.AddAuthorization();
builder.Services.AddRazorPages(o =>
{
    o.Conventions.AuthorizeFolder("/");
    o.Conventions.AllowAnonymousToPage("/Index");
    o.Conventions.AllowAnonymousToPage("/Error");
    o.Conventions.AllowAnonymousToFolder("/Account");
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    // Camera is needed for the barcode scanner on our own origin only.
    headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()";
    await next();
});

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();
app.MapRazorPages().WithStaticAssets();

// ---- JSON API used by the barcode scanner ----------------------------------------------------------
var api = app.MapGroup("/api").RequireAuthorization();

api.MapGet("/products/{barcode}", async (string barcode, ClaimsPrincipal principal, UserManager<AppUser> users, ProductLookupService lookup, CancellationToken ct) =>
{
    if (!ProductLookupService.IsValidBarcode(barcode))
    {
        return Results.BadRequest(new { error = "Barcodes must be 6-14 digits." });
    }
    var userId = users.GetUserId(principal)!;
    var product = await lookup.LookupAsync(barcode, userId, ct);
    return product is null ? Results.NotFound(new { barcode }) : Results.Ok(ProductDto.From(product));
});

app.Run();

/// <summary>Shape of a product returned to the scanner page.</summary>
internal sealed record ProductDto(
    string Barcode, string Name, string? Brand, string? ServingDescription, double? ServingGrams,
    double? CaloriesPer100g, double? ProteinPer100g, double? CarbsPer100g, double? FatPer100g,
    double? CaloriesPerServing, double? ProteinPerServing, double? CarbsPerServing, double? FatPerServing,
    string? ImageUrl, string Source, bool IsCustom)
{
    public static ProductDto From(Product p) => new(
        p.Barcode, p.Name, p.Brand, p.ServingDescription, p.ServingGrams,
        p.CaloriesPer100g, p.ProteinPer100g, p.CarbsPer100g, p.FatPer100g,
        p.CaloriesPerServing, p.ProteinPerServing, p.CarbsPerServing, p.FatPerServing,
        p.ImageUrl, p.Source, p.OwnerId != "");
}

public partial class Program;
