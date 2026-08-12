import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../src/modules/mail/encryption.service';

describe('EncryptionService', () => {
  const config = { getOrThrow: () => 'test-encryption-key-with-enough-entropy' } as unknown as ConfigService;

  it('cifra y descifra secretos SMTP', () => {
    const service = new EncryptionService(config);
    const encrypted = service.encrypt('smtp-secret');
    expect(encrypted).not.toContain('smtp-secret');
    expect(service.decrypt(encrypted)).toBe('smtp-secret');
  });

  it('usa un IV diferente en cada cifrado', () => {
    const service = new EncryptionService(config);
    expect(service.encrypt('same-secret')).not.toBe(service.encrypt('same-secret'));
  });
});

