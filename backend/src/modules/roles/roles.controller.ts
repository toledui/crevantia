import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { Permissions } from '../../common/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';
import { RolesService } from './roles.service';

@Controller('admin/settings/roles')
@UseGuards(AccessTokenGuard, PermissionsGuard)
@Permissions('roles.manage')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get() list() { return this.roles.list(); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) { return this.roles.create(user.sub, dto); }
  @Patch(':id') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRoleDto) { return this.roles.update(user.sub, id, dto); }
  @Delete(':id') remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.roles.remove(user.sub, id); }
}
