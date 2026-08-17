import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../common/permissions.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({ controllers: [UsersController], providers: [UsersService, PermissionsGuard] })
export class UsersModule {}
