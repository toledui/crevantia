import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AccessTokenGuard } from "../../common/access-token.guard";
import type { AuthenticatedUser } from "../../common/auth.types";
import { CurrentUser } from "../../common/current-user.decorator";
import { Permissions } from "../../common/permissions.decorator";
import { PermissionsGuard } from "../../common/permissions.guard";
import { RecalculateResultDto } from "./results.dto";
import { ListAdminResultsDto } from "./admin-results.dto";
import { ResultsService } from "./results.service";

@Controller()
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get("admin/results")
  @Permissions("admin.access", "result.read")
  adminList(@Query() dto: ListAdminResultsDto) {
    return this.results.listAdminResults(dto);
  }

  @Get("admin/results/summary")
  @Permissions("admin.access", "result.read")
  adminSummary() {
    return this.results.getAdminResultsSummary();
  }

  @Get("admin/results/norms")
  @Permissions("admin.access", "result.read")
  adminNorms() {
    return this.results.getAvailableNorms();
  }

  @Get("admin/results/:id")
  @Permissions("admin.access", "result.read")
  adminDetail(@Param("id") id: string) {
    return this.results.getAdminResultDetails(id);
  }

  @Get("results/:id")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("exact") exact?: string,
  ) {
    return this.results.get(user, id, exact === "true" || exact === "1");
  }

  @Get("results/:id/audit")
  audit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.results.audit(user, id);
  }

  @Post("results/:id/recalculate")
  recalculate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RecalculateResultDto,
  ) {
    return this.results.recalculate(user, id, dto);
  }
}
