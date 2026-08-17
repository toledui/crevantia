import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/common/permissions.guard';

describe('PermissionsGuard', () => {
  function context(permissions?: string[]) {
    return {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
    } as unknown as ExecutionContext;
  }

  it('permite el acceso cuando están todos los permisos requeridos', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin.access', 'roles.manage']) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(context(['admin.access', 'roles.manage']))).toBe(true);
  });

  it('rechaza el acceso cuando falta un permiso requerido', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['roles.manage']) } as unknown as Reflector;
    expect(() => new PermissionsGuard(reflector).canActivate(context(['admin.access']))).toThrow(ForbiddenException);
  });

  it('rechaza tokens anteriores que no incluyen permisos', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin.access']) } as unknown as Reflector;
    expect(() => new PermissionsGuard(reflector).canActivate(context())).toThrow(ForbiddenException);
  });
});
