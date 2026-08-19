import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../common/access-token.guard';
import type { AuthenticatedUser } from '../../common/auth.types';
import { CurrentUser } from '../../common/current-user.decorator';
import { Permissions } from '../../common/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { ChangeUserStatusDto, CreateUserAssignmentDto, CreateUserDto, ListUsersDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() @Permissions('admin.access', 'users.read') list(@Query() dto: ListUsersDto) { return this.users.list(dto); }
  @Get('assignable-tests') @Permissions('admin.access', 'users.read') getAssignableTests() { return this.users.getAssignableTests(); }
  @Post() @Permissions('admin.access', 'users.create') create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateUserDto) { return this.users.create(actor, dto); }
  @Get(':id/assignments') @Permissions('admin.access', 'users.read') getUserAssignments(@Param('id') id: string) { return this.users.getUserAssignments(id); }
  @Post(':id/assignments') @Permissions('admin.access', 'assignments.create') assignTest(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateUserAssignmentDto) { return this.users.assignTest(actor, id, dto); }
  @Post('assignments/:assignmentId/resend') @Permissions('admin.access', 'assignments.create') resendAssignmentInvitation(@CurrentUser() actor: AuthenticatedUser, @Param('assignmentId') assignmentId: string) { return this.users.resendAssignmentInvitation(actor, assignmentId); }
  @Delete('assignments/:assignmentId') @Permissions('admin.access', 'users.update') revokeAssignment(@CurrentUser() actor: AuthenticatedUser, @Param('assignmentId') assignmentId: string) { return this.users.revokeAssignment(actor, assignmentId); }
  @Put(':id') @Permissions('admin.access', 'users.update') update(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateUserDto) { return this.users.update(actor, id, dto); }
  @Patch(':id/status') @Permissions('admin.access', 'users.disable') changeStatus(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ChangeUserStatusDto) { return this.users.changeStatus(actor, id, dto); }
  @Delete(':id') @Permissions('admin.access', 'users.disable') remove(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.users.changeStatus(actor, id, { status: 'DISABLED' }); }
  @Post(':id/invitation') @Permissions('admin.access', 'users.create') resendInvitation(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.users.resendInvitation(actor, id); }
}
