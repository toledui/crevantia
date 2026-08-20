import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { AssessmentReportsController } from "./assessment-reports.controller";
import { AssessmentReportsService } from "./assessment-reports.service";
import { ReportPdfService } from "./report-pdf.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AssessmentReportsController],
  providers: [AssessmentReportsService, ReportPdfService],
  exports: [AssessmentReportsService],
})
export class AssessmentReportsModule {}
