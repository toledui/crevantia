import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { PrismaService } from '../../database/prisma.service';

@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPERADMIN', 'ADMIN')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard')
  async dashboard() {
    const [users, tests, activeAttempts, completedAttempts] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.test.count({ where: { isActive: true } }),
      this.prisma.attempt.count({ where: { status: { in: ['IN_PROGRESS', 'PAUSED'] } } }),
      this.prisma.attempt.count({ where: { status: 'COMPLETED' } }),
    ]);
    return { users, tests, activeAttempts, completedAttempts };
  }

  @Get('users')
  users() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, firstName: true, lastName: true, status: true, createdAt: true, roles: { select: { role: { select: { code: true, name: true } } } } },
    });
  }

  @Get('tests')
  tests() {
    return this.prisma.test.findMany({ include: { versions: { orderBy: { version: 'desc' } } } });
  }
}

