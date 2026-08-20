import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
  CreateNormTargetDto,
  CreateNormSetDto,
  ImportNormDto,
  ImpactPreviewDto,
  ReplaceThresholdsDto,
  UpdateNormTargetDto,
  UpdateNormSetDto,
  UpdateNormVersionDto,
} from "./norms.dto";
import { NormsService } from "./norms.service";

@Controller()
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class NormsController {
  constructor(private readonly norms: NormsService) {}

  @Get("norms") @Permissions("norm.read") list() {
    return this.norms.list();
  }
  @Post("norms") @Permissions("norm.create") create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNormSetDto,
  ) {
    return this.norms.create(user.sub, dto);
  }
  @Post("norms/import") @Permissions("norm.create") import(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportNormDto,
  ) {
    return this.norms.import(user.sub, dto.payload);
  }
  @Get("norms/:id") @Permissions("norm.read") detail(@Param("id") id: string) {
    return this.norms.detail(id);
  }
  @Get("norms/:id/versions") @Permissions("norm.read") versions(
    @Param("id") id: string,
  ) {
    return this.norms.versions(id);
  }
  @Get("norms/:id/versions/:versionId") @Permissions("norm.read") version(
    @Param("versionId") versionId: string,
  ) {
    return this.norms.version(versionId);
  }
  @Get("norms/:id/versions/:versionId/export")
  @Permissions("norm.read")
  exportVersion(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
  ) {
    return this.norms.exportVersion(id, versionId);
  }
  @Put("norms/:id") @Permissions("norm.edit") updateSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateNormSetDto,
  ) {
    return this.norms.updateSet(user.sub, id, dto);
  }
  @Post("norms/:id/versions/:versionId/clone")
  @Permissions("norm.edit")
  clone(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("versionId") versionId: string,
  ) {
    return this.norms.clone(user.sub, id, versionId);
  }
  @Put("norm-versions/:id") @Permissions("norm.edit") updateVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateNormVersionDto,
  ) {
    return this.norms.updateVersion(user.sub, id, dto);
  }
  @Post("norm-versions/:id/targets") @Permissions("norm.edit") createTarget(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CreateNormTargetDto,
  ) {
    return this.norms.createTarget(user.sub, id, dto);
  }
  @Put("norm-versions/:id/targets/:targetId")
  @Permissions("norm.edit")
  updateTarget(
    @CurrentUser() user: AuthenticatedUser,
    @Param("targetId") targetId: string,
    @Body() dto: UpdateNormTargetDto,
  ) {
    return this.norms.updateTarget(user.sub, targetId, dto);
  }
  @Delete("norm-versions/:id/targets/:targetId")
  @Permissions("norm.edit")
  removeTarget(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("targetId") targetId: string,
  ) {
    return this.norms.removeTarget(user.sub, id, targetId);
  }
  @Put("norm-targets/:targetId/thresholds")
  @Permissions("norm.edit")
  thresholds(
    @CurrentUser() user: AuthenticatedUser,
    @Param("targetId") targetId: string,
    @Body() dto: ReplaceThresholdsDto,
  ) {
    return this.norms.replaceThresholds(user.sub, targetId, dto);
  }
  @Post("norm-versions/:id/validate") @Permissions("norm.review") validate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.norms.validate(user.sub, id);
  }
  @Post("norm-versions/:id/submit-review")
  @Permissions("norm.review")
  submitReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.norms.submitReview(user.sub, id);
  }
  @Post("norm-versions/:id/approve") @Permissions("norm.approve") approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.norms.approve(user.sub, id);
  }
  @Post("norm-versions/:id/publish") @Permissions("norm.publish") publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.norms.publish(user.sub, id);
  }
  @Post("norm-versions/:id/archive") @Permissions("norm.archive") archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.norms.archive(user.sub, id);
  }
  @Get("norm-versions/:id/compare/:otherVersionId")
  @Permissions("norm.read")
  compare(
    @Param("id") id: string,
    @Param("otherVersionId") otherVersionId: string,
  ) {
    return this.norms.compare(id, otherVersionId);
  }
  @Post("norm-versions/:id/impact-preview") @Permissions("norm.read") impact(
    @Param("id") id: string,
    @Body() dto: ImpactPreviewDto,
  ) {
    return this.norms.impactPreview(id, dto);
  }
}
