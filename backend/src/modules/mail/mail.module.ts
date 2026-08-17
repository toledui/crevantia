import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { MailSettingsController } from './mail-settings.controller';
import { MailService } from './mail.service';
import { PermissionsGuard } from '../../common/permissions.guard';

@Global()
@Module({
  controllers: [MailSettingsController],
  providers: [EncryptionService, MailService, PermissionsGuard],
  exports: [MailService],
})
export class MailModule {}
