import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { Permissions } from '../../common/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { UpdateFinancialSettingsDto } from './financial.dto';
import { FinancialService } from './financial.service';

@Controller('admin/settings/financial')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@Permissions('pricing.manage', 'settings.update')
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  @Get()
  get() {
    return this.financial.getSettings();
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateFinancialSettingsDto) {
    return this.financial.updateSettings(user.sub, dto);
  }
}

@Controller('pricing/settings')
export class PublicFinancialController {
  constructor(private readonly financial: FinancialService) {}

  @Get()
  get() {
    return this.financial.getSettings();
  }
}
