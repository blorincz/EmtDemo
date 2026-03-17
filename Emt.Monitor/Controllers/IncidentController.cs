using System.Text.Json;
using Emt.Monitor.Models;
using Microsoft.AspNetCore.Mvc;

namespace Emt.Monitor.Controllers;

public class IncidentController : Controller
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<IncidentController> _logger;

    public IncidentController(IHttpClientFactory httpClientFactory, ILogger<IncidentController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<IActionResult> Index(string patientName = "", DateTime? from = null, DateTime? to = null)
    {
        var client = _httpClientFactory.CreateClient("emtApi");
        var query = new List<string>();
        if (!string.IsNullOrWhiteSpace(patientName)) query.Add($"patientName={Uri.EscapeDataString(patientName)}");
        if (from.HasValue) query.Add($"from={Uri.EscapeDataString(from.Value.ToString("o"))}");
        if (to.HasValue) query.Add($"to={Uri.EscapeDataString(to.Value.ToString("o"))}");

        var url = "/api/incidents" + (query.Any() ? "?" + string.Join("&", query) : string.Empty);
        try
        {
            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();
            using var stream = await response.Content.ReadAsStreamAsync();
            var incidents = await JsonSerializer.DeserializeAsync<List<IncidentViewModel>>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            ViewData["PatientName"] = patientName;
            ViewData["From"] = from?.ToString("yyyy-MM-ddTHH:mm");
            ViewData["To"] = to?.ToString("yyyy-MM-ddTHH:mm");
            return View(incidents ?? new List<IncidentViewModel>());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load incidents");
            ViewData["Error"] = "Cannot load incidents from API. Ensure API is running.";
            return View(new List<IncidentViewModel>());
        }
    }
}
