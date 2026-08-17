import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../common/permissions.guard';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({ controllers: [RolesController], providers: [RolesService, PermissionsGuard] })
export class RolesModule {}
