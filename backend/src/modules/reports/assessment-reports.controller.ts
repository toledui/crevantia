import { Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AccessTokenGuard } from "../../common/access-token.guard";
import type { AuthenticatedUser } from "../../common/auth.types";
import { CurrentUser } from "../../common/current-user.decorator";
import { AssessmentReportsService } from "./assessment-reports.service";

@Controller("results/:id/report")
@UseGuards(AccessTokenGuard)
export class AssessmentReportsController {
  constructor(private readonly reports: AssessmentReportsService) {}

  @Get("status")
  status(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.reports.status(user, id);
  }

  @Get()
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const file = await this.reports.download(user, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Length", String(file.buffer.length));
    response.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    response.send(file.buffer);
  }

  @Post("email")
  resend(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.reports.resend(user, id);
  }
}
