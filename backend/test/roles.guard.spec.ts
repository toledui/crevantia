import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../src/common/roles.guard';

describe('RolesGuard', () => {
  function context(roles: string[]) {
    return {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user: { roles } }) }),
    } as unknown as ExecutionContext;
  }

  it('permite el acceso cuando el usuario tiene un rol requerido', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(context(['ADMIN']))).toBe(true);
  });

  it('rechaza el acceso cuando falta el rol requerido', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
    expect(() => new RolesGuard(reflector).canActivate(context(['USER']))).toThrow(ForbiddenException);
  });

  it('no trata el alias SUPER_ADMIN como superadministrador', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
    expect(() => new RolesGuard(reflector).canActivate(context(['SUPER_ADMIN']))).toThrow(ForbiddenException);
  });
});
