using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace CalorieCopilot.Pages;

public class IndexModel : PageModel
{
    public IActionResult OnGet() => User.Identity?.IsAuthenticated == true ? RedirectToPage("/Diary") : Page();
}
