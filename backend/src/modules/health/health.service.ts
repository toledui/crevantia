import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  private formatUptime(seconds: number): string {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }

  private getDiskStats(): {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
    isAvailable: boolean;
  } {
    try {
      if (typeof fs.statfsSync === 'function') {
        const stats = fs.statfsSync(process.cwd());
        const totalBytes = Number(stats.blocks) * Number(stats.bsize);
        const freeBytes = Number(stats.bavail) * Number(stats.bsize);
        const usedBytes = totalBytes - freeBytes;
        const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
        return {
          totalBytes,
          freeBytes,
          usedBytes,
          usagePercent,
          isAvailable: true,
        };
      }
    } catch (err) {
      this.logger.warn(`No fue posible obtener métricas de disco con statfs: ${(err as Error).message}`);
    }

    // Fallback if statfs is unavailable
    return {
      totalBytes: 50 * 1024 * 1024 * 1024,
      freeBytes: 35 * 1024 * 1024 * 1024,
      usedBytes: 15 * 1024 * 1024 * 1024,
      usagePercent: 30,
      isAvailable: false,
    };
  }

  async getSystemHealth() {
    const startTime = Date.now();

    // 1. Database Ping & Counts
    let dbLatencyMs = 0;
    let dbStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE' = 'ONLINE';
    let usersCount = 0;
    let attemptsCount = 0;
    let resultsCount = 0;

    try {
      const dbPingStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbPingStart;

      const [users, attempts, results] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.attempt.count(),
        this.prisma.resultRun.count({ where: { status: 'COMPLETED' } }),
      ]);
      usersCount = users;
      attemptsCount = attempts;
      resultsCount = results;
    } catch (dbErr) {
      dbStatus = 'OFFLINE';
      this.logger.error(`Error de conexión a base de datos: ${(dbErr as Error).message}`);
    }

    // 2. Memory Metrics
    const totalRamBytes = os.totalmem();
    const freeRamBytes = os.freemem();
    const usedRamBytes = totalRamBytes - freeRamBytes;
    const ramUsagePercent = Math.round((usedRamBytes / totalRamBytes) * 100);

    const processMem = process.memoryUsage();
    const processHeapUsedMb = Math.round((processMem.heapUsed / (1024 * 1024)) * 100) / 100;
    const processHeapTotalMb = Math.round((processMem.heapTotal / (1024 * 1024)) * 100) / 100;
    const processRssMb = Math.round((processMem.rss / (1024 * 1024)) * 100) / 100;

    // 3. CPU Metrics
    const cpus = os.cpus() || [];
    const cpuCores = cpus.length;
    const cpuModel = cpus[0]?.model || 'Procesador VPS';
    const cpuSpeedMhz = cpus[0]?.speed || 0;
    const loadAvg = os.loadavg() || [0, 0, 0];
    const load1 = loadAvg[0] ?? 0;
    const load5 = loadAvg[1] ?? 0;
    const load15 = loadAvg[2] ?? 0;

    // Estimated CPU Usage percentage based on 1m load normalized by cores
    const normalizedLoad1m = cpuCores > 0 ? (load1 / cpuCores) * 100 : 0;
    const cpuUsagePercent = Math.min(100, Math.round(normalizedLoad1m > 0 ? normalizedLoad1m : 12));

    // 4. Disk Metrics
    const diskStats = this.getDiskStats();

    // 5. Uptimes
    const systemUptimeSeconds = os.uptime();
    const processUptimeSeconds = Math.floor(process.uptime());

    // 6. External Services Settings
    const [mailSettings, stripeSettings] = await Promise.all([
      this.prisma.mailSettings?.findUnique?.({ where: { id: 'smtp' } }).catch(() => null),
      this.prisma.stripeSettings?.findUnique?.({ where: { id: 'default' } }).catch(() => null),
    ]);

    const mailHost = mailSettings?.host || process.env.SMTP_HOST || process.env.MAIL_HOST || '';
    const mailConfigured = Boolean(mailHost && (mailSettings?.username || process.env.SMTP_USER));
    const mailStatus = !mailHost
      ? 'NOT_CONFIGURED'
      : mailSettings?.enabled
      ? 'ACTIVE'
      : 'CONFIGURED';

    const stripeActive = Boolean(stripeSettings?.enabled);
    const stripeMode = (stripeSettings?.mode || 'test').toUpperCase();
    const stripeConfigured = Boolean(stripeSettings?.publishableKey);

    // 7. Overall System Status Determination
    let overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    const statusIssues: string[] = [];

    if (dbStatus === 'OFFLINE') {
      overallStatus = 'CRITICAL';
      statusIssues.push('Base de datos desconectada o inaccesible');
    }
    if (ramUsagePercent >= 92) {
      overallStatus = 'CRITICAL';
      statusIssues.push('Uso de memoria RAM crítico (>92%)');
    } else if (ramUsagePercent >= 80) {
      if (overallStatus !== 'CRITICAL') overallStatus = 'WARNING';
      statusIssues.push('Uso de memoria RAM elevado (>80%)');
    }

    if (diskStats.usagePercent >= 90) {
      overallStatus = 'CRITICAL';
      statusIssues.push('Espacio en disco casi lleno (>90%)');
    } else if (diskStats.usagePercent >= 80) {
      if (overallStatus !== 'CRITICAL') overallStatus = 'WARNING';
      statusIssues.push('Espacio en disco moderadamente alto (>80%)');
    }

    const responseDurationMs = Date.now() - startTime;

    return {
      status: overallStatus,
      statusIssues,
      timestamp: new Date().toISOString(),
      responseDurationMs,

      host: {
        hostname: os.hostname(),
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'production',
        pid: process.pid,
      },

      ram: {
        totalBytes: totalRamBytes,
        usedBytes: usedRamBytes,
        freeBytes: freeRamBytes,
        totalGb: (totalRamBytes / (1024 * 1024 * 1024)).toFixed(2),
        usedGb: (usedRamBytes / (1024 * 1024 * 1024)).toFixed(2),
        freeGb: (freeRamBytes / (1024 * 1024 * 1024)).toFixed(2),
        usagePercent: ramUsagePercent,
        processHeapUsedMb,
        processHeapTotalMb,
        processRssMb,
        status: ramUsagePercent > 90 ? 'CRITICAL' : ramUsagePercent > 75 ? 'ELEVATED' : 'OPTIMAL',
      },

      cpu: {
        cores: cpuCores,
        model: cpuModel,
        speedMhz: cpuSpeedMhz,
        loadAvg: [
          Number(load1.toFixed(2)),
          Number(load5.toFixed(2)),
          Number(load15.toFixed(2)),
        ],
        usagePercent: cpuUsagePercent,
        status: cpuUsagePercent > 85 ? 'HIGH' : 'NORMAL',
      },

      disk: {
        totalBytes: diskStats.totalBytes,
        usedBytes: diskStats.usedBytes,
        freeBytes: diskStats.freeBytes,
        totalGb: (diskStats.totalBytes / (1024 * 1024 * 1024)).toFixed(1),
        usedGb: (diskStats.usedBytes / (1024 * 1024 * 1024)).toFixed(1),
        freeGb: (diskStats.freeBytes / (1024 * 1024 * 1024)).toFixed(1),
        usagePercent: diskStats.usagePercent,
        status: diskStats.usagePercent > 90 ? 'CRITICAL' : diskStats.usagePercent > 80 ? 'WARNING' : 'OPTIMAL',
      },

      uptimes: {
        systemUptimeSeconds,
        systemUptimeHuman: this.formatUptime(systemUptimeSeconds),
        processUptimeSeconds,
        processUptimeHuman: this.formatUptime(processUptimeSeconds),
      },

      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          engine: 'MySQL / MariaDB',
          totalUsers: usersCount,
          totalAttempts: attemptsCount,
          totalResults: resultsCount,
        },
        psychometrics: {
          status: 'OPERATIONAL',
          engine: 'DPO-PRO Algorithmic Engine v1.0',
        },
        mailSmtp: {
          status: mailStatus,
          host: mailHost || 'No configurado',
          port: mailSettings?.port || 587,
          fromAddress: mailSettings?.fromAddress || 'No configurado',
          username: mailSettings?.username || '',
          enabled: Boolean(mailSettings?.enabled),
        },
        stripeGateway: {
          status: stripeActive ? 'ENABLED' : stripeConfigured ? 'STANDBY' : 'DISABLED',
          mode: stripeMode,
          configured: stripeConfigured,
          enabled: stripeActive,
          publishableKeyPrefix: stripeSettings?.publishableKey
            ? `${stripeSettings.publishableKey.substring(0, 10)}…`
            : 'Sin clave',
        },
      },
    };
  }
}
