import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  deprecatedPermissionCodes,
  permissionCatalog,
  restrictedAdminPermissions,
} from '../prisma/seeds/permission-catalog';

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : typescriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('Catálogo de permisos RBAC', () => {
  it('declara cada permiso aplicado por controladores y servicios', () => {
    const referenced = new Set<string>();
    const permissionLiteral = /["']([a-z][a-z0-9_]*\.[a-z][a-z0-9_.]*)["']/g;

    for (const file of typescriptFiles(join(__dirname, '../src'))) {
      const source = readFileSync(file, 'utf8');
      const protectedExpressions = [
        ...source.matchAll(/@Permissions\(([^)]*)\)/gs),
        ...source.matchAll(/permissions(?:\?)?\.includes\(([^)]*)\)/gs),
      ];
      for (const expression of protectedExpressions) {
        for (const match of (expression[1] ?? '').matchAll(permissionLiteral)) {
          if (match[1]) referenced.add(match[1]);
        }
      }
    }

    const missing = [...referenced].filter((code) => !(code in permissionCatalog));
    expect(missing).toEqual([]);
  });

  it('incluye capacidades configurables para todos los módulos críticos', () => {
    const criticalCodes = [
      'attempts.manage',
      'report_studio.manage',
      'stripe.settings.manage',
      'system.health.read',
      'roles.manage',
    ] as const;
    for (const code of criticalCodes) expect(permissionCatalog[code].length).toBeGreaterThan(0);
  });

  it('no expone permisos históricos sin una acción vigente', () => {
    for (const code of deprecatedPermissionCodes) expect(code in permissionCatalog).toBe(false);
  });

  it('mantiene fuera de ADMIN los accesos críticos predeterminados', () => {
    expect(restrictedAdminPermissions.size).toBeGreaterThan(0);
    expect(restrictedAdminPermissions.has('roles.manage')).toBe(true);
    expect(restrictedAdminPermissions.has('settings.manage')).toBe(true);
    expect(restrictedAdminPermissions.has('report_studio.manage')).toBe(true);
    expect(restrictedAdminPermissions.has('norm.publish')).toBe(true);
  });
});
