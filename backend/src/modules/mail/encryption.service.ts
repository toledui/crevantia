import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = createHash('sha256').update(config.getOrThrow<string>('ENCRYPTION_KEY')).digest();
  }

  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
  }

  decrypt(value: string) {
    const parts = value.split('.');
    if (parts.length !== 3) throw new Error('El secreto cifrado no tiene un formato válido.');
    const [ivPart, tagPart, encryptedPart] = parts;
    if (!ivPart || !tagPart || !encryptedPart) throw new Error('El secreto cifrado está incompleto.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64url')), decipher.final()]).toString('utf8');
  }
}

