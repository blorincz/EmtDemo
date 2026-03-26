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

    public async Task<IActionResult> Details(int id)
    {
        var client = _httpClientFactory.CreateClient("emtApi");
        try
        {
            var response = await client.GetAsync($"/api/incidents/{id}");
            if (response.IsSuccessStatusCode)
            {
                using var stream = await response.Content.ReadAsStreamAsync();
                var incident = await JsonSerializer.DeserializeAsync<IncidentViewModel>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web));
                return PartialView("_IncidentDetails", incident);
            }
            return NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load incident {Id}", id);
            return StatusCode(500);
        }
    }

    public async Task<IActionResult> Table(string patientName = "", DateTime? from = null, DateTime? to = null)
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
            return PartialView("_IncidentTable", incidents ?? new List<IncidentViewModel>());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load incidents for table");
            return PartialView("_IncidentTable", new List<IncidentViewModel>());
        }
    }

    // Add this to IncidentController.cs
    [HttpPost]
    public async Task<IActionResult> Delete(int id)
    {
        var client = _httpClientFactory.CreateClient("emtApi");
        try
        {
            var response = await client.DeleteAsync($"/api/incidents/{id}");
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Deleted incident {Id}", id);
                return Ok(new { success = true });
            }

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return NotFound(new { success = false, message = "Incident not found" });
            }

            return StatusCode((int)response.StatusCode, new { success = false, message = "Failed to delete incident" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete incident {Id}", id);
            return StatusCode(500, new { success = false, message = "Error deleting incident" });
        }
    }
}
