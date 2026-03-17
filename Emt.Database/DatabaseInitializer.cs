using Emt.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Emt.Database;

public static class DatabaseInitializer
{
    public static async Task InitializeAsync(DbContext context, ILogger logger)
    {
        logger.LogInformation("Ensuring database exists...");
        await context.Database.EnsureCreatedAsync();

        var incidents = context.Set<Incident>();
        if (!await incidents.AnyAsync())
        {
            logger.LogInformation("Seeding initial incidents...");
            incidents.AddRange(
                new Incident
                {
                    PatientName = "Anna Taylor",
                    IncidentAt = DateTime.UtcNow.AddMinutes(-30),
                    Location = "Downtown Plaza",
                    CrewMember = "Jackson",
                    Notes = "Patient conscious, stable",
                    Pulse = 88,
                    Systolic = 120,
                    Diastolic = 78,
                    TemperatureC = 37.0,
                    RespiratoryRate = 16,
                    SpO2 = 97,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new Incident
                {
                    PatientName = "Robert Green",
                    IncidentAt = DateTime.UtcNow.AddHours(-1),
                    Location = "Main Street / 8th",
                    CrewMember = "Nina",
                    Notes = "Chest pain reported, oxygen applied",
                    Pulse = 110,
                    Systolic = 138,
                    Diastolic = 88,
                    TemperatureC = 36.9,
                    RespiratoryRate = 20,
                    SpO2 = 93,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            );
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded initial incidents.");
        }
        else
        {
            logger.LogInformation("Incidents already exist; skipping seed.");
        }
    }
}
