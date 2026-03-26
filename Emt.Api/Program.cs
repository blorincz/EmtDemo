using Emt.Api.Data;
using Emt.Database;
using Emt.Shared;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .AllowAnyOrigin()
        .AllowAnyHeader()
        .AllowAnyMethod());
});

builder.Services.AddDbContext<EmtDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Server=(localdb)\\mssqllocaldb;Database=EmtDemo;Trusted_Connection=True;";
    options.UseSqlServer(connectionString);
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseHttpsRedirection();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<EmtDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    await DatabaseInitializer.InitializeAsync(db, logger);
}

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    timestamp = DateTime.UtcNow
})).WithName("HealthCheck");

app.MapGet("/api/incidents", async (HttpContext http, EmtDbContext db, string? patientName, DateTime? from, DateTime? to) =>
{
    var query = db.Incidents.AsQueryable();
    if (!string.IsNullOrWhiteSpace(patientName))
        query = query.Where(i => i.PatientName.Contains(patientName));
    if (from.HasValue)
        query = query.Where(i => i.IncidentAt >= from.Value);
    if (to.HasValue)
        query = query.Where(i => i.IncidentAt <= to.Value);

    query = query.OrderByDescending(i => i.IncidentAt);
    var incidents = await query.Take(500).ToListAsync();
    return Results.Ok(incidents);
}).WithName("GetIncidents");

app.MapGet("/api/incidents/{id:int}", async (int id, EmtDbContext db) =>
{
    var incident = await db.Incidents.FindAsync(id);
    return incident is not null ? Results.Ok(incident) : Results.NotFound();
}).WithName("GetIncidentById");

app.MapPost("/api/incidents", async (Incident incident, EmtDbContext db) =>
{
    incident.CreatedAt = DateTime.UtcNow;
    incident.UpdatedAt = DateTime.UtcNow;
    db.Incidents.Add(incident);
    await db.SaveChangesAsync();
    return Results.Created($"/api/incidents/{incident.Id}", incident);
}).WithName("CreateIncident");

app.MapPut("/api/incidents/{id:int}", async (int id, Incident incoming, EmtDbContext db) =>
{
    var incident = await db.Incidents.FindAsync(id);
    if (incident is null) return Results.NotFound();
    incident.PatientName = incoming.PatientName;
    incident.IncidentAt = incoming.IncidentAt;
    incident.Location = incoming.Location;
    incident.CrewMember = incoming.CrewMember;
    incident.Notes = incoming.Notes;
    incident.Pulse = incoming.Pulse;
    incident.Systolic = incoming.Systolic;
    incident.Diastolic = incoming.Diastolic;
    incident.TemperatureC = incoming.TemperatureC;
    incident.RespiratoryRate = incoming.RespiratoryRate;
    incident.SpO2 = incoming.SpO2;
    incident.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.NoContent();
}).WithName("UpdateIncident");

app.MapDelete("/api/incidents/{id:int}", async (int id, EmtDbContext db) =>
{
    var incident = await db.Incidents.FindAsync(id);
    if (incident is null) return Results.NotFound();
    db.Incidents.Remove(incident);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).WithName("DeleteIncident");

app.Run();
