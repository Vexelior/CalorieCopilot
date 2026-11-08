using System.ComponentModel.DataAnnotations;
using CalorieCopilot.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace CalorieCopilot.Pages.Account;

public class RegisterModel(UserManager<AppUser> userManager, SignInManager<AppUser> signInManager, ILogger<RegisterModel> logger) : PageModel
{
    [BindProperty]
    public InputModel Input { get; set; } = new();

    public string? ReturnUrl { get; set; }

    public sealed class InputModel
    {
        [Required, StringLength(50), Display(Name = "Your name")]
        public string DisplayName { get; set; } = "";

        [Required, EmailAddress, StringLength(254)]
        public string Email { get; set; } = "";

        [Required, StringLength(100, MinimumLength = 8, ErrorMessage = "The {0} must be at least {2} characters long."), DataType(DataType.Password)]
        public string Password { get; set; } = "";

        [Required, DataType(DataType.Password), Display(Name = "Confirm password")]
        [Compare(nameof(Password), ErrorMessage = "The passwords do not match.")]
        public string ConfirmPassword { get; set; } = "";

        public string? TimeZone { get; set; }
    }

    public IActionResult OnGet(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true) return RedirectToPage("/Diary");
        ReturnUrl = returnUrl;
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(string? returnUrl = null)
    {
        ReturnUrl = returnUrl;
        if (!ModelState.IsValid) return Page();

        var email = Input.Email.Trim();
        var user = new AppUser
        {
            UserName = email,
            Email = email,
            DisplayName = Input.DisplayName.Trim(),
            TimeZone = IsKnownTimeZone(Input.TimeZone) ? Input.TimeZone! : "UTC",
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var result = await userManager.CreateAsync(user, Input.Password);
        if (result.Succeeded)
        {
            logger.LogInformation("New account created.");
            await signInManager.SignInAsync(user, isPersistent: true);
            TempData["Success"] = $"Welcome, {user.DisplayName}! Set up your goals on the Profile page for personalised targets.";
            return !string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl) ? LocalRedirect(returnUrl) : RedirectToPage("/Profile");
        }

        // Username == email, so duplicate-name and duplicate-email errors collapse into one message.
        var messages = result.Errors
            .Select(e => e.Code is nameof(IdentityErrorDescriber.DuplicateUserName) or nameof(IdentityErrorDescriber.DuplicateEmail)
                ? $"An account with {email} already exists."
                : e.Description)
            .Distinct();
        foreach (var message in messages)
        {
            ModelState.AddModelError(string.Empty, message);
        }
        return Page();
    }

    internal static bool IsKnownTimeZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return false;
        try { TimeZoneInfo.FindSystemTimeZoneById(id); return true; }
        catch (Exception) { return false; }
    }
}
