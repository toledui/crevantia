import { LegalService } from '../src/modules/legal/legal.service';

describe('LegalService', () => {
  let service: LegalService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      legalDocument: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };
    service = new LegalService(prismaMock);
  });

  it('retorna plantilla predeterminada si no existe documento en la base de datos', async () => {
    prismaMock.legalDocument.findUnique.mockResolvedValue(null);

    const terms = await service.getDocument('TERMS_AND_CONDITIONS');
    expect(terms.title).toContain('Términos y Condiciones');
    expect(terms.content).toContain('Crevantia');
    expect(terms.version).toBe('1.0');

    const privacy = await service.getDocument('PRIVACY_POLICY');
    expect(privacy.title).toContain('Política de Privacidad');
    expect(privacy.content).toContain('Datos Personales');
  });

  it('actualiza o crea documento legal y registra auditoría', async () => {
    prismaMock.legalDocument.findUnique.mockResolvedValue(null);
    prismaMock.legalDocument.upsert.mockResolvedValue({
      id: 'doc-1',
      type: 'TERMS_AND_CONDITIONS',
      title: 'Términos Actualizados 2026',
      content: '# Nuevos Términos',
      version: '1.1',
      updatedBy: 'admin-1',
      updatedAt: new Date(),
    });

    const result = await service.updateDocument('admin-1', {
      type: 'TERMS_AND_CONDITIONS',
      title: 'Términos Actualizados 2026',
      content: '# Nuevos Términos',
      version: '1.1',
    });

    expect(result.title).toBe('Términos Actualizados 2026');
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'LEGAL_DOCUMENT_UPDATED',
          actorId: 'admin-1',
        }),
      }),
    );
  });
});
