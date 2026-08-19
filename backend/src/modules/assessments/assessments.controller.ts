import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AccessTokenGuard } from "../../common/access-token.guard";
import type { AuthenticatedUser } from "../../common/auth.types";
import { CurrentUser } from "../../common/current-user.decorator";
import { Permissions } from "../../common/permissions.decorator";
import { PermissionsGuard } from "../../common/permissions.guard";
import { AssessmentsService } from "./assessments.service";
import { AssessmentScoringService } from "./assessment-scoring.service";
import { SaveAttemptAnswerDto, SaveDemographicsDto } from "./assessments.dto";
import { AdminAttemptActionDto, ListAdminAttemptsDto } from "./admin-attempts.dto";

@Controller()
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class AssessmentsController {
  constructor(
    private readonly assessments: AssessmentsService,
    private readonly scoring: AssessmentScoringService,
  ) {}

  @Get("admin/attempts")
  @Permissions("admin.access", "attempts.read")
  adminList(@Query() dto: ListAdminAttemptsDto) {
    return this.assessments.listAdminAttempts(dto);
  }

  @Get("admin/attempts/summary")
  @Permissions("admin.access", "attempts.read")
  adminSummary() {
    return this.assessments.getAdminAttemptsSummary();
  }

  @Get("admin/attempts/:id")
  @Permissions("admin.access", "attempts.read")
  adminDetail(@Param("id") id: string) {
    return this.assessments.getAdminAttemptDetail(id);
  }

  @Post("admin/attempts/:id/reopen")
  @Permissions("admin.access", "attempts.manage")
  adminReopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AdminAttemptActionDto,
  ) {
    return this.assessments.reopenAdminAttempt(user, id, dto.reason);
  }

  @Get("me/assignments") assignments(@CurrentUser() user: AuthenticatedUser) {
    return this.assessments.myAssignments(user);
  }
  @Post("assignments/:id/start") start(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.assessments.startAssignment(user, id);
  }
  @Get("assessments/:id/versions/:versionId") version(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
  ) {
    return this.assessments.version(id, versionId);
  }
  @Get("attempts/:id/questions") questions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.assessments.player(user, id);
  }
  @Get("attempts/:id/player") player(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.assessments.player(user, id);
  }
  @Put("attempts/:id/answers/:questionId") answer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("questionId") questionId: string,
    @Body() dto: SaveAttemptAnswerDto,
  ) {
    return this.assessments.saveAnswer(user, id, questionId, dto);
  }
  @Put("attempts/:id/pairs/:questionId") pair(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("questionId") questionId: string,
    @Body() dto: SaveAttemptAnswerDto,
  ) {
    return this.assessments.saveAnswer(user, id, questionId, dto);
  }
  @Put("attempts/:id/likert/:questionId") likert(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("questionId") questionId: string,
    @Body() dto: SaveAttemptAnswerDto,
  ) {
    return this.assessments.saveAnswer(user, id, questionId, dto);
  }
  @Put("attempts/:id/demographics") demographics(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SaveDemographicsDto,
  ) {
    return this.assessments.saveDemographics(user, id, dto);
  }
  @Post("attempts/:id/submit") submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.scoring.finalize(user, id);
  }
  @Post("attempts/:id/finalize") finalize(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.scoring.finalize(user, id);
  }
  @Post("attempts/:id/pause") pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.assessments.pause(user, id);
  }
}
