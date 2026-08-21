import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/database/prisma.service';
import { ReportStudioStatus } from '../src/generated/prisma/client';
import { ReportStudioService } from '../src/modules/report-studio/report-studio.service';

describe('ReportStudioService revisions', () => {
  const source = {
    id: 'revision-source', reportTemplateId: 'template-1', version: '1.0.2', status: ReportStudioStatus.PUBLISHED,
    themeId: 'theme-1', layoutJson: { pages: [{ pageId: 'page-1', blocks: [] }] },
    bindingConfigJson: { schemaVersion: '1.0.0', bindingPresets: [] }, pendingBindings: 0,
    configurationHash: 'old-hash', template: { id: 'template-1', testLinks: [] }, theme: null,
  };

  function setup(sourceStatus: ReportStudioStatus = ReportStudioStatus.PUBLISHED) {
    const original = { ...source, status: sourceStatus };
    const created = { ...original, id: 'revision-new', version: '1.0.3', status: ReportStudioStatus.PUBLISHED, configurationHash: 'new-hash' };
    const tx = {
      reportTemplateVersion: {
        findMany: jest.fn().mockResolvedValue([{ version: '1.0.0' }, { version: '1.0.2' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(original),
        create: jest.fn().mockResolvedValue(created),
      },
      reportTemplate: { update: jest.fn().mockResolvedValue({ id: 'template-1' }) },
    };
    const prisma = {
      reportTemplateVersion: { findUnique: jest.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(created) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    return { tx, prisma, service: new ReportStudioService(prisma as unknown as PrismaService, {} as ConfigService) };
  }

  it('creates and publishes a new semantic revision without mutating the published source snapshot', async () => {
    const { tx, service } = setup();
    const layout = { pages: [{ pageId: 'page-1', blocks: [{ id: 'heading-1', type: 'HEADING' }] }] };
    const result = await service.saveRevision('admin-1', source.id, { layoutJson: layout, bindingConfigJson: source.bindingConfigJson });
    expect(result).toMatchObject({ id: 'revision-new', version: '1.0.3', status: ReportStudioStatus.PUBLISHED });
    expect(tx.reportTemplateVersion.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: ReportStudioStatus.ARCHIVED } }));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    expect(tx.reportTemplateVersion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ version: '1.0.3', status: ReportStudioStatus.PUBLISHED, layoutJson: layout }) });
  });

  it('restores an archived snapshot by publishing a new revision', async () => {
    const { tx, service } = setup(ReportStudioStatus.ARCHIVED);
    await service.restoreRevision('admin-1', source.id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    expect(tx.reportTemplateVersion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ version: '1.0.3', layoutJson: source.layoutJson }) });
    expect(tx.reportTemplateVersion.update).not.toHaveBeenCalled();
  });
});
