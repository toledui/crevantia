import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import { Permissions } from '../../common/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { PrismaService } from '../../database/prisma.service';

@Controller('admin')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@Permissions('admin.access')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard')
  @Permissions('admin.access', 'dashboard.read')
  async dashboard() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [
      users,
      tests,
      activeAttempts,
      completedAttempts,
      totalResults,
      publishedNorms,
      stalledAttempts,
      pausedAttempts,
      recentCompleted,
      recentUsers,
      attemptsLast14Days,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.test.count({ where: { isActive: true } }),
      this.prisma.attempt.count({ where: { status: { in: ['IN_PROGRESS', 'PAUSED'] } } }),
      this.prisma.attempt.count({ where: { status: 'COMPLETED' } }),
      this.prisma.resultRun.count({ where: { status: 'COMPLETED' } }),
      this.prisma.normVersion.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.attempt.findMany({
        where: { status: 'IN_PROGRESS', lastActivityAt: { lt: twoHoursAgo } },
        take: 3,
        include: {
          assignment: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              test: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.attempt.findMany({
        where: { status: 'PAUSED' },
        take: 3,
        include: {
          assignment: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              test: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.attempt.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 5,
        include: {
          assignment: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              test: { select: { name: true } },
            },
          },
          resultRuns: {
            where: { isOfficial: true },
            take: 1,
            select: { id: true, calculatedAt: true },
          },
        },
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, firstName: true, lastName: true, email: true, createdAt: true, status: true },
      }),
      this.prisma.attempt.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { id: true, createdAt: true, completedAt: true, status: true },
      }),
    ]);

    // Build 14-day timeline
    const days: Array<{ date: string; label: string; created: number; completed: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const dayLabel = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(d);

      const dayAttempts = attemptsLast14Days.filter(
        (a) => a.createdAt.toISOString().slice(0, 10) === dateKey,
      );
      const dayCompleted = attemptsLast14Days.filter(
        (a) => a.completedAt && a.completedAt.toISOString().slice(0, 10) === dateKey,
      );

      days.push({
        date: dateKey,
        label: dayLabel,
        created: dayAttempts.length,
        completed: dayCompleted.length,
      });
    }

    // Build attention items
    const attentionItems: Array<{
      id: string;
      severity: 'danger' | 'warning' | 'cyan';
      title: string;
      subtitle: string;
      actionLabel: string;
      href: string;
    }> = [];

    stalledAttempts.forEach((att) => {
      attentionItems.push({
        id: `stalled-${att.id}`,
        severity: 'danger',
        title: 'Intento sin actividad (>2h)',
        subtitle: `${att.assignment.user.firstName} ${att.assignment.user.lastName} · ${att.assignment.test.name}`,
        actionLabel: 'Revisar',
        href: '/admin/evaluaciones',
      });
    });

    pausedAttempts.forEach((att) => {
      attentionItems.push({
        id: `paused-${att.id}`,
        severity: 'warning',
        title: 'Evaluación pausada',
        subtitle: `${att.assignment.user.firstName} ${att.assignment.user.lastName} · ${att.assignment.test.name}`,
        actionLabel: 'Reanudar',
        href: '/admin/evaluaciones',
      });
    });

    return {
      metrics: {
        users,
        tests,
        activeAttempts,
        completedAttempts,
        totalResults,
        publishedNorms,
      },
      activityFlow: days,
      attentionItems: attentionItems.slice(0, 5),
      recentActivity: recentCompleted.map((att) => ({
        id: att.id,
        candidateName: `${att.assignment.user.firstName} ${att.assignment.user.lastName}`,
        candidateEmail: att.assignment.user.email,
        testName: att.assignment.test.name,
        completedAt: att.completedAt,
        resultRunId: att.resultRuns[0]?.id ?? null,
      })),
      recentUsers,
    };
  }

  @Get('global-search')
  @Permissions('admin.access')
  async globalSearch(@Query('q') query?: string) {
    const q = (query || '').trim();
    if (q.length < 2) {
      return { users: [], attempts: [], results: [], navigation: [] };
    }

    const navigationLinks = [
      { title: 'Usuarios del sistema', subtitle: 'Gestión de cuentas y asignaciones', href: '/admin/usuarios', keywords: 'usuarios cuentas roles permisos crear' },
      { title: 'Monitoreo de Evaluaciones', subtitle: 'Consola operativa en tiempo real', href: '/admin/evaluaciones', keywords: 'evaluaciones intentos aplicaciones monitoreo reanudar' },
      { title: 'Resultados y Reportes', subtitle: 'Reportes ejecutivos y recalificaciones', href: '/admin/reportes', keywords: 'resultados reportes pdf deciles baremos calificaciones' },
      { title: 'Pruebas y Reactivos', subtitle: 'Banco de preguntas y versiones', href: '/admin/pruebas', keywords: 'pruebas reactivos preguntas banco dpo' },
      { title: 'Normas y Matrices', subtitle: 'Baremos y tablas psicométricas', href: '/admin/normas', keywords: 'normas matrices baremos percentiles deciles' },
      { title: 'Pagos y Catálogo', subtitle: 'Configuración comercial y precios', href: '/admin/pagos', keywords: 'pagos compras catálogo precios productos stripe ordenes' },
      { title: 'Configuración General', subtitle: 'Ajustes de la plataforma', href: '/admin/configuracion', keywords: 'configuración sistema correo smtp ajustes términos privacidad' },
      { title: 'Estado del Servidor', subtitle: 'Salud del sistema, RAM, CPU, disco y VPS', href: '/admin/salud', keywords: 'servidor salud vps ram cpu disco memoria estado telemetría rendimiento hardware' },
    ];

    const matchedNav = navigationLinks.filter((n) =>
      n.title.toLowerCase().includes(q.toLowerCase()) ||
      n.keywords.toLowerCase().includes(q.toLowerCase())
    );

    const [users, attempts, results] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
          ],
        },
        take: 4,
        select: { id: true, firstName: true, lastName: true, email: true, status: true },
      }),
      this.prisma.attempt.findMany({
        where: {
          OR: [
            { assignment: { user: { firstName: { contains: q } } } },
            { assignment: { user: { lastName: { contains: q } } } },
            { assignment: { user: { email: { contains: q } } } },
            { assignment: { test: { name: { contains: q } } } },
          ],
        },
        take: 4,
        include: {
          assignment: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              test: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.resultRun.findMany({
        where: {
          status: 'COMPLETED',
          OR: [
            { attempt: { assignment: { user: { firstName: { contains: q } } } } },
            { attempt: { assignment: { user: { lastName: { contains: q } } } } },
            { attempt: { assignment: { user: { email: { contains: q } } } } },
          ],
        },
        take: 4,
        include: {
          attempt: {
            include: {
              assignment: {
                include: {
                  user: { select: { firstName: true, lastName: true, email: true } },
                  test: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      navigation: matchedNav.map((n) => ({
        id: n.href,
        title: n.title,
        subtitle: n.subtitle,
        type: 'navigation',
        href: n.href,
      })),
      users: users.map((u) => ({
        id: u.id,
        title: `${u.firstName} ${u.lastName}`,
        subtitle: u.email,
        type: 'user',
        href: `/admin/usuarios?search=${encodeURIComponent(u.email)}`,
      })),
      attempts: attempts.map((a) => ({
        id: a.id,
        title: `${a.assignment.test.name} — ${a.assignment.user.firstName} ${a.assignment.user.lastName}`,
        subtitle: `Estado: ${a.status === 'COMPLETED' ? 'Finalizada' : a.status === 'IN_PROGRESS' ? 'En curso' : 'Pausada'} (${a.assignment.user.email})`,
        type: 'attempt',
        href: `/admin/evaluaciones?search=${encodeURIComponent(a.assignment.user.email)}`,
      })),
      results: results.map((r) => ({
        id: r.id,
        title: `Reporte: ${r.attempt.assignment.test.name} (${r.attempt.assignment.user.firstName} ${r.attempt.assignment.user.lastName})`,
        subtitle: `Calculado: ${new Date(r.calculatedAt).toLocaleDateString('es-MX')} · ${r.isOfficial ? 'Oficial' : 'Recalculado'}`,
        type: 'result',
        href: `/admin/reportes?search=${encodeURIComponent(r.attempt.assignment.user.email)}`,
      })),
    };
  }
}
