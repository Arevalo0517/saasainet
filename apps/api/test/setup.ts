import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const candidates = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '../../.env.local'),
  resolve(__dirname, '../../.env.local'),
  resolve(__dirname, '../../../.env.local'),
];

let loaded = false;
for (const candidate of candidates) {
  if (existsSync(candidate)) {
    const text = readFileSync(candidate, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
    loaded = true;
    break;
  }
}

void loaded;

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  process.env.AUTH_SECRET = 'a'.repeat(48);
}
if (!process.env.AUTH_ISSUER) {
  process.env.AUTH_ISSUER = 'plataforma-saas-chatbots-test';
}
if (!process.env.PLATFORM_ENCRYPTION_KEY) {
  process.env.PLATFORM_ENCRYPTION_KEY = randomBytes(32).toString('hex');
}
if (!process.env.PAYMENT_MOCK_SECRET) {
  process.env.PAYMENT_MOCK_SECRET = 'test-mock-secret-min-16-chars-aaaa';
}