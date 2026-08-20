import { Module } from '@nestjs/common';
import { ReportStudioController, ReportStudioRenderController } from './report-studio.controller';
import { ReportStudioService } from './report-studio.service';

@Module({
  controllers: [ReportStudioController, ReportStudioRenderController],
  providers: [ReportStudioService],
  exports: [ReportStudioService],
})
export class ReportStudioModule {}
