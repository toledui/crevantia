import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from './auth.types';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const { user } = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    if (!user) throw new ForbiddenException('Usuario no autenticado.');
    if (user.roles?.includes('SUPERADMIN') || user.roles?.includes('SUPER_ADMIN')) {
      return true;
    }
    if (required.some((role) => user.roles.includes(role))) return true;
    throw new ForbiddenException('No tienes permisos para realizar esta acción.');
  }
}

