import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { AccessTokenGuard } from "../../common/access-token.guard";
import type { AuthenticatedUser } from "../../common/auth.types";
import { CurrentUser } from "../../common/current-user.decorator";
import { Permissions } from "../../common/permissions.decorator";
import { PermissionsGuard } from "../../common/permissions.guard";
import {
  CloneAssessmentVersionDto,
  CreateAssessmentDto,
  ReplaceAssessmentContentDto,
  UpdateAssessmentDto,
} from "./assessment-admin.dto";
import { AssessmentAdminService } from "./assessment-admin.service";

@Controller("admin/assessments")
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class AssessmentAdminController {
  constructor(private readonly assessments: AssessmentAdminService) {}

  @Get()
  @Permissions("admin.access", "assessment.read")
  list() {
    return this.assessments.list();
  }

  @Get("scales")
  @Permissions("admin.access", "scoring.read")
  scales() {
    return this.assessments.scales();
  }

  @Get(":id")
  @Permissions("admin.access", "assessment.read")
  detail(@Param("id") id: string) {
    return this.assessments.detail(id);
  }

  @Post()
  @Permissions("admin.access", "assessment.manage")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.assessments.create(user.sub, dto);
  }

  @Patch(":id")
  @Permissions("admin.access", "assessment.manage")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateAssessmentDto,
  ) {
    return this.assessments.update(user.sub, id, dto);
  }

  @Post(":id/versions")
  @Permissions("admin.access", "assessment.manage")
  cloneVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CloneAssessmentVersionDto,
  ) {
    return this.assessments.cloneVersion(user.sub, id, dto);
  }

  @Put("versions/:versionId/content")
  @Permissions("admin.access", "assessment.manage", "scoring.manage")
  replaceContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("versionId") versionId: string,
    @Body() dto: ReplaceAssessmentContentDto,
  ) {
    return this.assessments.replaceContent(user.sub, versionId, dto);
  }

  @Post("versions/:versionId/validate")
  @Permissions("admin.access", "assessment.read", "scoring.read")
  validate(@Param("versionId") versionId: string) {
    return this.assessments.validate(versionId);
  }

  @Post("versions/:versionId/publish")
  @Permissions("admin.access", "assessment.manage", "scoring.manage")
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("versionId") versionId: string,
  ) {
    return this.assessments.publish(user.sub, versionId);
  }

  @Post("versions/:versionId/archive")
  @Permissions("admin.access", "assessment.manage")
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("versionId") versionId: string,
  ) {
    return this.assessments.archive(user.sub, versionId);
  }
}
