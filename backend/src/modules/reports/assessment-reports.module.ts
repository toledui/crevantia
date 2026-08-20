import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { AssessmentReportsController } from "./assessment-reports.controller";
import { AssessmentReportsService } from "./assessment-reports.service";
import { ReportPdfService } from "./report-pdf.service";
import { ReportStudioModule } from "../report-studio/report-studio.module";

@Module({
  imports: [DatabaseModule, ReportStudioModule],
  controllers: [AssessmentReportsController],
  providers: [AssessmentReportsService, ReportPdfService],
  exports: [AssessmentReportsService],
})
export class AssessmentReportsModule {}
