import { HealthService } from '../src/modules/health/health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
      user: { count: jest.fn().mockResolvedValue(12) },
      attempt: { count: jest.fn().mockResolvedValue(25) },
      resultRun: { count: jest.fn().mockResolvedValue(18) },
      mailSettings: { findUnique: jest.fn().mockResolvedValue({ host: 'smtp.mail.com', username: 'admin' }) },
      stripeSettings: { findUnique: jest.fn().mockResolvedValue({ enabled: true, mode: 'TEST' }) },
    };
    service = new HealthService(prismaMock);
  });

  it('obtiene métricas completas de salud del sistema y del servidor VPS', async () => {
    const health = await service.getSystemHealth();

    expect(health.status).toBeDefined();
    expect(['HEALTHY', 'WARNING', 'CRITICAL']).toContain(health.status);
    expect(health.ram.totalGb).toBeDefined();
    expect(health.ram.usagePercent).toBeGreaterThanOrEqual(0);
    expect(health.cpu.cores).toBeGreaterThan(0);
    expect(health.disk.usagePercent).toBeGreaterThanOrEqual(0);
    expect(health.uptimes.systemUptimeHuman).toBeDefined();
    expect(health.services.database.status).toBe('ONLINE');
    expect(health.services.database.totalUsers).toBe(12);
    expect(health.services.stripeGateway.status).toBe('ENABLED');
  });
});
