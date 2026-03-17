using Microsoft.EntityFrameworkCore;
using Emt.Shared;

namespace Emt.Api.Data;

public class EmtDbContext : DbContext
{
    public EmtDbContext(DbContextOptions<EmtDbContext> options) : base(options)
    {
    }

    public DbSet<Incident> Incidents => Set<Incident>();
}
