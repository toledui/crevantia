import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { Permissions } from '../../common/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { MailService } from './mail.service';
import { TestMailSettingsDto, UpdateMailSettingsDto } from './mail-settings.dto';

@Controller('admin/settings/mail')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@Permissions('mail.settings.manage')
export class MailSettingsController {
  constructor(private readonly mail: MailService) {}

  @Get()
  get() { return this.mail.publicSettings(); }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMailSettingsDto) {
    return this.mail.updateSettings(user.sub, dto);
  }

  @Post('test')
  test(@CurrentUser() user: AuthenticatedUser, @Body() dto: TestMailSettingsDto) {
    return this.mail.testSettings(user.sub, dto.email);
  }
}
