import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from './auth.types';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const { user } = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    if (!user) throw new ForbiddenException('Usuario no autenticado.');
    if (user.roles?.includes('SUPERADMIN') || user.permissions?.includes('*')) {
      return true;
    }
    if (required.every((permission) => user.permissions?.includes(permission))) return true;
    throw new ForbiddenException('No tienes permisos para realizar esta acción.');
  }
}
