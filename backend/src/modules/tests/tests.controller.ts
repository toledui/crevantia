import { Body, Controller, Get, Param, Patch, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from '../../common/access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { Permissions } from '../../common/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { CreateTestDto, CreateVersionDto, ReplaceVersionContentDto, UpdateTestDto } from './tests.dto';
import { TestsService } from './tests.service';

@Controller('admin/tests')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class TestsController {
  constructor(private readonly tests: TestsService) {}

  @Get() @Permissions('admin.access', 'tests.read') list() { return this.tests.list(); }
  @Get(':id') @Permissions('admin.access', 'tests.read') detail(@Param('id') id: string) { return this.tests.detail(id); }
  @Post() @Permissions('admin.access', 'tests.manage') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTestDto) { return this.tests.create(user.sub, dto); }
  @Patch(':id') @Permissions('admin.access', 'tests.manage') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTestDto) { return this.tests.update(user.sub, id, dto); }
  @Post(':testId/versions') @Permissions('admin.access', 'tests.manage') createVersion(@CurrentUser() user: AuthenticatedUser, @Param('testId') testId: string, @Body() dto: CreateVersionDto) { return this.tests.createVersion(user.sub, testId, dto); }
  @Put('versions/:versionId/content') @Permissions('admin.access', 'tests.manage') replaceContent(@CurrentUser() user: AuthenticatedUser, @Param('versionId') versionId: string, @Body() dto: ReplaceVersionContentDto) { return this.tests.replaceContent(user.sub, versionId, dto); }
  @Post('versions/:versionId/import-client-workbook') @Permissions('admin.access', 'tests.import') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } })) importClientWorkbook(@CurrentUser() user: AuthenticatedUser, @Param('versionId') versionId: string, @UploadedFile() file: Express.Multer.File | undefined) { return this.tests.importClientWorkbook(user.sub, versionId, file); }
  @Post('versions/:versionId/publish') @Permissions('admin.access', 'tests.publish') publish(@CurrentUser() user: AuthenticatedUser, @Param('versionId') versionId: string) { return this.tests.publish(user.sub, versionId); }
  @Post('versions/:versionId/archive') @Permissions('admin.access', 'tests.publish') archive(@CurrentUser() user: AuthenticatedUser, @Param('versionId') versionId: string) { return this.tests.archive(user.sub, versionId); }
}
