import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { MailSettingsController } from './mail-settings.controller';
import { MailService } from './mail.service';

@Global()
@Module({
  controllers: [MailSettingsController],
  providers: [EncryptionService, MailService],
  exports: [MailService],
})
export class MailModule {}

