import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CustomCodeSettingsController, PublicSiteSettingsController, ReportSettingsController, SiteSettingsController } from './site-settings.controller';
import { SiteSettingsService } from './site-settings.service';

@Module({ imports: [DatabaseModule], controllers: [PublicSiteSettingsController, SiteSettingsController, ReportSettingsController, CustomCodeSettingsController], providers: [SiteSettingsService], exports: [SiteSettingsService] })
export class SiteSettingsModule {}
