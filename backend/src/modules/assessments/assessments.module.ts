import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { AssessmentsController } from "./assessments.controller";
import { AssessmentAdminController } from "./assessment-admin.controller";
import { AssessmentAdminService } from "./assessment-admin.service";
import { AssessmentScoringService } from "./assessment-scoring.service";
import { AssessmentsService } from "./assessments.service";
import { AssessmentReportsModule } from "../reports/assessment-reports.module";

@Module({
  imports: [DatabaseModule, AssessmentReportsModule],
  controllers: [AssessmentsController, AssessmentAdminController],
  providers: [
    AssessmentsService,
    AssessmentScoringService,
    AssessmentAdminService,
  ],
  exports: [AssessmentScoringService],
})
export class AssessmentsModule {}
