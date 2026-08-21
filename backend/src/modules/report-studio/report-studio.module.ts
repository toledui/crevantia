import { Module } from '@nestjs/common';
import { ReportStudioAssetController, ReportStudioController, ReportStudioRenderController } from './report-studio.controller';
import { ReportStudioService } from './report-studio.service';

@Module({
  controllers: [ReportStudioController, ReportStudioRenderController, ReportStudioAssetController],
  providers: [ReportStudioService],
  exports: [ReportStudioService],
})
export class ReportStudioModule {}
