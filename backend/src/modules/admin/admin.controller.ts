import { Controller, Get, UseGuards } from '@nestjs/common';
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
    const [users, tests, activeAttempts, completedAttempts] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.test.count({ where: { isActive: true } }),
      this.prisma.attempt.count({ where: { status: { in: ['IN_PROGRESS', 'PAUSED'] } } }),
      this.prisma.attempt.count({ where: { status: 'COMPLETED' } }),
    ]);
    return { users, tests, activeAttempts, completedAttempts };
  }
}
