import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  buildOtpAuthUrl,
  decodeBase32,
  decryptMfaSecret,
  encryptMfaSecret,
  generateTotpSecret,
  verifyTotp,
} from '../../src/services/identity/mfa.js';

const AUTH_SECRET = 'a'.repeat(48);

describe('mfa', () => {
  it('genera secretos base32 únicos de 32 caracteres', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/u);
    expect(b).toMatch(/^[A-Z2-7]{32}$/u);
    expect(a).not.toBe(b);
  });

  it('cifra y descifra secreto TOTP con AES-256-GCM', () => {
    const plain = generateTotpSecret();
    const cipher = encryptMfaSecret(plain, AUTH_SECRET);
    expect(cipher).not.toContain(plain);
    expect(cipher.split('.').length).toBe(3);
    expect(decryptMfaSecret(cipher, AUTH_SECRET)).toBe(plain);
  });

  it('descifrar con AUTH_SECRET distinto produce basura o falla', () => {
    const plain = generateTotpSecret();
    const cipher = encryptMfaSecret(plain, AUTH_SECRET);
    const otherSecret = 'b'.repeat(48);
    expect(() => decryptMfaSecret(cipher, otherSecret)).toThrow();
  });

  it('cifrados del mismo plaintext son distintos (IV aleatorio)', () => {
    const plain = generateTotpSecret();
    const a = encryptMfaSecret(plain, AUTH_SECRET);
    const b = encryptMfaSecret(plain, AUTH_SECRET);
    expect(a).not.toBe(b);
    expect(decryptMfaSecret(a, AUTH_SECRET)).toBe(plain);
    expect(decryptMfaSecret(b, AUTH_SECRET)).toBe(plain);
  });

  it('construye otpauth URL con issuer y label correctos', () => {
    const url = buildOtpAuthUrl({
      email: 'super@acme-fabricante.test',
      secret: 'JBSWY3DPEHPK3PXP',
      issuer: 'AcmeFabricante',
    });
    expect(url.startsWith('otpauth://totp/AcmeFabricante%3Asuper%40acme-fabricante.test?')).toBe(true);
    expect(url).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(url).toContain('issuer=AcmeFabricante');
    expect(url).toContain('algorithm=SHA1');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
  });

  it('verifyTotp rechaza códigos con formato inválido', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, 'abc123')).toBe(false);
    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, '1234567')).toBe(false);
  });

  it('verifyTotp acepta código generado con mismo secret/tiempo', () => {
    const secret = generateTotpSecret();
    const now = new Date();
    const period = 30;
    const counter = Math.floor(now.getTime() / 1000 / period);
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter));
    const secretBytes = decodeBase32(secret);
    const hmac = createHmac('sha1', secretBytes).update(buf).digest();
    const offset = hmac[hmac.length - 1]! & 0x0f;
    const binCode =
      ((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff);
    const code = (binCode % 1_000_000).toString().padStart(6, '0');
    expect(verifyTotp(secret, code, { now })).toBe(true);
  });
});