import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import { Permissions } from '../../common/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  check() {
    return { status: 'ok', service: 'crevantia-api', timestamp: new Date().toISOString() };
  }

  @Get('admin/system-health')
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @Permissions('admin.access', 'system.health.read')
  getSystemHealth() {
    return this.healthService.getSystemHealth();
  }
}
