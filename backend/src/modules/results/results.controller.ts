import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AccessTokenGuard } from "../../common/access-token.guard";
import type { AuthenticatedUser } from "../../common/auth.types";
import { CurrentUser } from "../../common/current-user.decorator";
import { RecalculateResultDto } from "./results.dto";
import { ResultsService } from "./results.service";

@Controller("results")
@UseGuards(AccessTokenGuard)
export class ResultsController {
  constructor(private readonly results: ResultsService) {}
  @Get(":id") get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.results.get(user, id);
  }
  @Get(":id/audit") audit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.results.audit(user, id);
  }
  @Post(":id/recalculate") recalculate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RecalculateResultDto,
  ) {
    return this.results.recalculate(user, id, dto);
  }
}
