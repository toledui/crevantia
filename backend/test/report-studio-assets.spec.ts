import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportStudioStatus } from '../src/generated/prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { ReportStudioService } from '../src/modules/report-studio/report-studio.service';

describe('ReportStudioService assets', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const file = { originalname: 'gráfica: final.png', mimetype: 'image/png', size: png.length, buffer: png } as Express.Multer.File;

  function setup() {
    const prisma = {
      reportTemplateVersion: { findUnique: jest.fn().mockResolvedValue({ id: 'version-1', status: ReportStudioStatus.DRAFT, themeId: 'theme-1', template: { testLinks: [] }, theme: null }) },
      reportAsset: {
        create: jest.fn().mockResolvedValue({ id: 'asset-1', name: 'gráfica- final.png', mimeType: 'image/png', byteSize: png.length }),
        findUnique: jest.fn().mockResolvedValue({ data: png, mimeType: 'image/png' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    return { prisma, service: new ReportStudioService(prisma as unknown as PrismaService, {} as ConfigService) };
  }

  it('stores a validated image and returns its stable URL', async () => {
    const { prisma, service } = setup();
    await expect(service.uploadAsset('admin-1', 'version-1', file)).resolves.toMatchObject({ id: 'asset-1', url: '/api/v1/report-studio/assets/asset-1' });
    // Jest's asymmetric matcher is intentionally typed as any.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    expect(prisma.reportAsset.create).toHaveBeenCalledWith({ data: expect.objectContaining({ themeId: 'theme-1', mimeType: 'image/png', byteSize: png.length }) });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects a file whose contents do not match its declared image type', async () => {
    const { service } = setup();
    const fake = { ...file, buffer: Buffer.from('not-an-image'), size: 12 } as Express.Multer.File;
    await expect(service.uploadAsset('admin-1', 'version-1', fake)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('serves the stored bytes with their MIME type', async () => {
    const { service } = setup();
    await expect(service.getAsset('asset-1')).resolves.toEqual({ data: png, mimeType: 'image/png' });
  });
});
