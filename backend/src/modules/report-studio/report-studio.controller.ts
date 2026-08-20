import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AccessTokenGuard } from '../../common/access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CreateReportTemplateDto, CreateVersionDto, GenerateReportDto, UpdateBindingDto, UpdateReportVersionDto, UpdateTemplateLinkDto } from './report-studio.dto';
import { ReportStudioService } from './report-studio.service';

@Controller('admin/report-studio')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPERADMIN', 'SUPER_ADMIN')
export class ReportStudioController {
  constructor(private readonly studio: ReportStudioService) {}

  @Get('templates') list() { return this.studio.listTemplates(); }
  @Get('catalog') catalog() { return this.studio.catalog(); }
  @Post('templates') createTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportTemplateDto) { return this.studio.createTemplate(user.sub, dto); }
  @Get('templates/:id') template(@Param('id') id: string) { return this.studio.getTemplate(id); }
  @Patch('templates/:id/link') link(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTemplateLinkDto) { return this.studio.updateTemplateLink(user.sub, id, dto); }
  @Get('versions/:id') version(@Param('id') id: string, @Query('resultRunId') resultRunId?: string) { return this.studio.getVersion(id, resultRunId); }
  @Patch('versions/:id') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateReportVersionDto) { return this.studio.updateVersion(user.sub, id, dto); }
  @Patch('versions/:id/binding') binding(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateBindingDto) { return this.studio.updateBinding(user.sub, id, dto); }
  @Post('versions/:id/publish') publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.studio.publish(user.sub, id); }
  @Post('versions/:id/clone') clone(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateVersionDto) { return this.studio.cloneVersion(user.sub, id, dto.version); }
  @Get('binding-options') bindingOptions() { return this.studio.bindingOptions(); }
  @Post('versions/:id/pdf') generate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: GenerateReportDto) { return this.studio.generatePdf(user.sub, id, dto); }
  @Post('result-runs/:resultRunId/pdf') generateForResult(@CurrentUser() user: AuthenticatedUser, @Param('resultRunId') resultRunId: string, @Body() dto: GenerateReportDto) { return this.studio.generateForResultRun(user.sub, resultRunId, dto); }
  @Get('generated/:id') async download(@Param('id') id: string, @Res() response: Response) {
    const file = await this.studio.download(id);
    response.set({ 'Content-Type': 'application/pdf', 'Content-Length': String(file.buffer.length), 'Content-Disposition': `attachment; filename="${file.filename}"` }).send(file.buffer);
  }
}

@Controller('report-studio/render-sessions')
export class ReportStudioRenderController {
  constructor(private readonly studio: ReportStudioService) {}
  @Get(':token') consume(@Param('token') token: string) { return this.studio.consumeRenderSession(token); }
}
