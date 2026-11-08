# CalorieCopilot

A calorie-tracking web app built with **ASP.NET Core (.NET 10) Razor Pages**, **ASP.NET Core Identity**, **Turso** (libSQL),
**Bootstrap 5** and **Bootstrap Icons**.

## Features

| | |
|---|---|
| **Daily diary** | Log breakfast, lunch, dinner and snacks. Shows a calorie ring against your goal, macro progress bars, edit/delete, quick-add from recent foods, "copy from yesterday" and day-by-day navigation. |
| **Barcode scanning** | Scan packaged food with your phone or laptop camera ([html5-qrcode](https://github.com/mebjas/html5-qrcode), using the native `BarcodeDetector` where available). You can also scan from a photo or type the number. Products are looked up in [Open Food Facts](https://world.openfoodfacts.org) and cached. Unknown products can be entered once and are remembered for your next scan. Supports EAN-13/8, UPC-A/E, Code 128 and ITF. |
| **Analytics** | 7/30/90-day views: daily calories vs. goal, average macro split, calories by meal, weight trend, logging streak, days on target and most-logged foods (with a table view of the raw data). Charts by Chart.js, with light and dark themes. |
| **Profile settings** | Display name, email, time zone (decides when your "today" starts), metric/imperial units, body stats and activity level, Mifflin-St Jeor target suggestions you can apply in one click, manual calorie/macro targets, password change and account deletion. |

It also has a mobile bottom tab bar, a dark mode toggle, account lockout after repeated failed sign-ins, and security headers.

## Running locally

Requires the [.NET 10 SDK](https://dotnet.microsoft.com/download).

```bash
cd src/CalorieCopilot
dotnet run
```

With no Turso settings, the app falls back to a local SQLite file at `src/CalorieCopilot/App_Data/caloriecopilot.db`,
so it runs with zero setup.

> **Camera access needs a secure context.** Browsers only allow the camera on `https://` or `http://localhost`.
> To test scanning on a phone, run `dotnet run --launch-profile https` and open the HTTPS URL, or use a tunnel
> such as `ngrok` / `cloudflared`. "Scan from photo" and manual entry work anywhere.

## Using Turso

1. Create a database and a token with the [Turso CLI](https://docs.turso.tech/cli/introduction):

   ```bash
   turso db create caloriecopilot
   turso db show caloriecopilot --url        # libsql://caloriecopilot-<org>.turso.io
   turso db tokens create caloriecopilot
   ```

2. Configure the app. In development, use user secrets:

   ```bash
   cd src/CalorieCopilot
   dotnet user-secrets set "Database:TursoUrl" "libsql://caloriecopilot-<org>.turso.io"
   dotnet user-secrets set "Database:TursoAuthToken" "<token>"
   ```

   In production, use environment variables:

   ```bash
   Database__TursoUrl=libsql://caloriecopilot-<org>.turso.io
   Database__TursoAuthToken=<token>
   ```

   `turso dev` also works for local development (`Database__TursoUrl=http://127.0.0.1:8080`, no token).

The schema is created automatically on startup with idempotent `CREATE TABLE IF NOT EXISTS` statements.

## How it fits together

```
src/CalorieCopilot
├── Data/                     # Database access
│   ├── IDatabase.cs          #   tiny SQL abstraction (positional ? parameters)
│   ├── TursoDatabase.cs      #   Turso via the Hrana-over-HTTP protocol (POST /v2/pipeline)
│   ├── SqliteDatabase.cs     #   local SQLite fallback (Microsoft.Data.Sqlite)
│   ├── DatabaseInitializer.cs#   schema
│   ├── DatabaseXmlRepository.cs # Data Protection keys stored in the DB
│   └── *Repository.cs        #   food log, products (barcode cache), weight logs
├── Identity/
│   └── DatabaseUserStore.cs  # ASP.NET Core Identity user store on top of IDatabase
├── Services/
│   ├── OpenFoodFactsClient.cs   # barcode -> nutrition lookup
│   ├── ProductLookupService.cs  # cache-first lookup (30-day refresh)
│   └── GoalCalculator.cs        # Mifflin-St Jeor BMR/TDEE -> calorie & macro targets
├── Pages/                    # Razor Pages: Diary, Scan, Analytics, Profile, Account/*
└── wwwroot/                  # site.css, page scripts, vendored Bootstrap, Bootstrap Icons, Chart.js, html5-qrcode
```

**Why no Entity Framework?** There is no first-party EF Core provider for Turso. Instead, the app talks to Turso's HTTP API
directly. It is pure managed code with no native libSQL binaries, so it runs anywhere .NET runs, including containers and
serverless. ASP.NET Core Identity is wired up with a custom `IUserStore` (passwords, email, security stamps, lockout,
optimistic concurrency) instead of the EF stores. Multi-statement work (schema setup, account deletion) runs as a Hrana
`batch` with conditional steps, so it commits or rolls back as a unit.

**Data Protection keys** (which sign auth cookies) are kept in the database, so sign-ins survive restarts and work across
several instances without shared disk.

**Product data** comes from Open Food Facts, licensed under the [ODbL](https://opendatacommons.org/licenses/odbl/1-0/).
Barcode lookups go through the server, which caches them, so the browser never calls third-party APIs directly.
