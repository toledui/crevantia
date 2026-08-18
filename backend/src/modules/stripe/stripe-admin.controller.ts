import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { Permissions } from '../../common/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { TestStripeSettingsDto, UpdateStripeSettingsDto } from './stripe.dto';
import { StripeService } from './stripe.service';

@Controller('admin/settings/stripe')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class StripeAdminController {
  constructor(private readonly stripeService: StripeService) {}

  @Get()
  @Permissions('admin.access', 'settings.manage')
  getSettings() {
    return this.stripeService.getAdminSettings();
  }

  @Patch()
  @Permissions('admin.access', 'settings.manage')
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateStripeSettingsDto) {
    return this.stripeService.updateAdminSettings(user.sub, dto);
  }

  @Post('test')
  @Permissions('admin.access', 'settings.manage')
  testConnection(@CurrentUser() user: AuthenticatedUser, @Body() dto?: TestStripeSettingsDto) {
    return this.stripeService.testConnection(user.sub, dto);
  }
}
