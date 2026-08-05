import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/services/identity/passwords.js';

describe('passwords', () => {
  it('hashea contraseñas con argon2id y produce hash verificable', async () => {
    const hash = await hashPassword('AcmeTest2026!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(hash, 'AcmeTest2026!')).resolves.toBe(true);
  });

  it('rechaza contraseña incorrecta', async () => {
    const hash = await hashPassword('AcmeTest2026!');
    await expect(verifyPassword(hash, 'otra-cosa')).resolves.toBe(false);
  });

  it('regresa false en hash corrupto sin lanzar excepción', async () => {
    await expect(verifyPassword('no-es-un-hash', 'cualquiera')).resolves.toBe(false);
  });

  it('genera hashes distintos para la misma contraseña (salt aleatorio)', async () => {
    const a = await hashPassword('AcmeTest2026!');
    const b = await hashPassword('AcmeTest2026!');
    expect(a).not.toBe(b);
    await expect(verifyPassword(a, 'AcmeTest2026!')).resolves.toBe(true);
    await expect(verifyPassword(b, 'AcmeTest2026!')).resolves.toBe(true);
  });
});