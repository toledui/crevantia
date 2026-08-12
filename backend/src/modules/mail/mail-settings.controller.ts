import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { MailService } from './mail.service';
import { UpdateMailSettingsDto } from './mail-settings.dto';

@Controller('admin/settings/mail')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPERADMIN')
export class MailSettingsController {
  constructor(private readonly mail: MailService) {}

  @Get()
  get() { return this.mail.publicSettings(); }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMailSettingsDto) {
    return this.mail.updateSettings(user.sub, dto);
  }

  @Post('test')
  test(@CurrentUser() user: AuthenticatedUser) { return this.mail.testSettings(user.sub); }
}

