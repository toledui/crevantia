import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth.types';
import { Permissions } from '../../common/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { UpdateLegalDocumentDto } from './legal.dto';
import { LegalService } from './legal.service';

@Controller()
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('legal/terms')
  getTerms() {
    return this.legalService.getDocument('TERMS_AND_CONDITIONS');
  }

  @Get('legal/privacy')
  getPrivacy() {
    return this.legalService.getDocument('PRIVACY_POLICY');
  }

  @Get('legal')
  getAllDocuments() {
    return this.legalService.getAllDocuments();
  }

  @Get('admin/legal')
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @Permissions('admin.access')
  getAdminDocuments() {
    return this.legalService.getAllDocuments();
  }

  @Put('admin/legal')
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @Permissions('admin.access')
  updateDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLegalDocumentDto,
  ) {
    return this.legalService.updateDocument(user.sub, dto);
  }
}
