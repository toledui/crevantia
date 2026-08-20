import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AccessTokenGuard } from '../../common/access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { UpdateCustomCodeDto, UpdateReportSettingsDto, UpdateSiteSettingsDto } from './site-settings.dto';
import { SiteSettingsService } from './site-settings.service';

@Controller('public/site-settings')
export class PublicSiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Get() get() { return this.settings.getPublic(); }
  @Get(':kind') async asset(@Param('kind') kind: string, @Res() response: Response) {
    if (kind !== 'logo' && kind !== 'favicon' && kind !== 'report-logo') throw new BadRequestException('Recurso inválido.');
    const asset = await this.settings.getAsset(kind);
    response.set({ 'Content-Type': asset.mimeType, 'Cache-Control': 'public, max-age=31536000, immutable' }).send(asset.data);
  }
}

@Controller('admin/settings/site')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPERADMIN', 'SUPER_ADMIN')
export class SiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Get() get() { return this.settings.getSiteAdmin(); }
  @Patch() update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSiteSettingsDto) { return this.settings.updateSite(user.sub, dto); }
  @Post('assets/:kind') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 3 * 1024 * 1024 } }))
  upload(@CurrentUser() user: AuthenticatedUser, @Param('kind') kind: string, @UploadedFile() file?: Express.Multer.File) {
    if (kind !== 'logo' && kind !== 'favicon') throw new BadRequestException('Tipo de recurso inválido.');
    return this.settings.uploadAsset(user.sub, kind, file);
  }
}

@Controller('admin/settings/report')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPERADMIN', 'SUPER_ADMIN')
export class ReportSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Get() get() { return this.settings.getReportAdmin(); }
  @Patch() update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateReportSettingsDto) { return this.settings.updateReport(user.sub, dto); }
  @Post('logo') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 3 * 1024 * 1024 } }))
  uploadLogo(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) { return this.settings.uploadAsset(user.sub, 'report-logo', file); }
}

@Controller('admin/settings/custom-code')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPERADMIN', 'SUPER_ADMIN')
export class CustomCodeSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Get() get() { return this.settings.getCustomCode(); }
  @Patch() update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCustomCodeDto) { return this.settings.updateCustomCode(user.sub, dto); }
}
