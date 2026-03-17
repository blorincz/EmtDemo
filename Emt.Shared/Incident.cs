namespace Emt.Shared;

public class Incident
{
    public int Id { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public DateTime IncidentAt { get; set; } = DateTime.UtcNow;
    public string Location { get; set; } = string.Empty;
    public string CrewMember { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public int Pulse { get; set; }
    public int Systolic { get; set; }
    public int Diastolic { get; set; }
    public double TemperatureC { get; set; }
    public int RespiratoryRate { get; set; }
    public int SpO2 { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
