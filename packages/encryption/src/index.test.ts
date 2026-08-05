import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  encryptString,
  decryptString,
  encryptJson,
  decryptJson,
  isEncryptedString,
  resetEncryptionKeyCache,
  setEncryptionKeyForTests,
} from '../src/index.js';

describe('@platform/encryption (AES-256-GCM)', () => {
  beforeEach(() => {
    setEncryptionKeyForTests(randomBytes(32));
  });

  it('round-trips a plaintext string', () => {
    const plain = 'whsec_abcdef0123456789';
    const enc = encryptString(plain);
    expect(enc).not.toBe(plain);
    expect(enc.split('.').length).toBe(3);
    expect(decryptString(enc)).toBe(plain);
  });

  it('round-trips a JSON object', () => {
    const obj = { api_key: 'EAABxyz', phone_number_id: '1234567890' };
    const enc = encryptJson(obj);
    expect(decryptJson<typeof obj>(enc)).toEqual(obj);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const plain = 'same-secret-value';
    const a = encryptString(plain);
    const b = encryptString(plain);
    expect(a).not.toBe(b);
    expect(decryptString(a)).toBe(plain);
    expect(decryptString(b)).toBe(plain);
  });

  it('AAD binds ciphertext to a context (decrypt fails if AAD mismatches)', () => {
    const enc = encryptString('top-secret', 'webhook:abc-123');
    expect(decryptString(enc, 'webhook:abc-123')).toBe('top-secret');
    expect(() => decryptString(enc, 'webhook:other-456')).toThrow();
  });

  it('detects tampered ciphertext via auth tag', () => {
    const enc = encryptString('untouched');
    const parts = enc.split('.');
    parts[2] = Buffer.from('AAAAAAAA').toString('base64');
    const tampered = parts.join('.');
    expect(() => decryptString(tampered)).toThrow();
  });

  it('isEncryptedString recognizes the format', () => {
    const enc = encryptString('hello');
    expect(isEncryptedString(enc)).toBe(true);
    expect(isEncryptedString('not-encrypted')).toBe(false);
    expect(isEncryptedString('a.b')).toBe(false);
  });

  it('rejects malformed payloads', () => {
    expect(() => decryptString('a.b.c.d')).toThrow(/invalid ciphertext format/);
    expect(() => decryptString('not_base64_iv.bad.tag.ct')).toThrow();
  });

  it('throws when key is missing (after cache reset)', () => {
    resetEncryptionKeyCache();
    const orig = process.env.PLATFORM_ENCRYPTION_KEY;
    delete process.env.PLATFORM_ENCRYPTION_KEY;
    expect(() => encryptString('x')).toThrow(/PLATFORM_ENCRYPTION_KEY is required/);
    process.env.PLATFORM_ENCRYPTION_KEY = orig;
    setEncryptionKeyForTests(randomBytes(32));
  });

  it('throws when key has wrong length', () => {
    resetEncryptionKeyCache();
    const orig = process.env.PLATFORM_ENCRYPTION_KEY;
    process.env.PLATFORM_ENCRYPTION_KEY = 'abcd';
    expect(() => encryptString('x')).toThrow(/must decode to 32 bytes/);
    process.env.PLATFORM_ENCRYPTION_KEY = orig;
    setEncryptionKeyForTests(randomBytes(32));
  });
});
