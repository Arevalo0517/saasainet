import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'sha1';
const TOTP_WINDOW = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const hkdfDerivedKey = (authSecret: string): Buffer => {
  const ikm = Buffer.from(authSecret, 'utf8');
  const salt = Buffer.from('platform-auth-mfa-v1', 'utf8');
  const info = Buffer.from('aes-256-gcm', 'utf8');
  const derived = hkdfSync('sha256', ikm, salt, info, 32);
  return Buffer.from(derived);
};

const base32Encode = (bytes: Buffer): string => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
};

const base32Decode = (input: string): Buffer => {
  const cleaned = input.replace(/=+$/u, '').toUpperCase().replace(/\s+/gu, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new Error(`Caracter base32 inválido: ${ch}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
};

export const generateTotpSecret = (): string => {
  const bytes = randomBytes(20);
  return base32Encode(bytes);
};

export const decodeBase32 = (input: string): Buffer => base32Decode(input);

export const encryptMfaSecret = (plainSecret: string, authSecret: string): string => {
  const key = hkdfDerivedKey(authSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`;
};

export const decryptMfaSecret = (cipherText: string, authSecret: string): string => {
  const parts = cipherText.split('.');
  if (parts.length !== 3) {
    throw new Error('Formato de MFA secret inválido.');
  }
  const iv = Buffer.from(parts[0]!, 'base64url');
  const ciphertext = Buffer.from(parts[1]!, 'base64url');
  const tag = Buffer.from(parts[2]!, 'base64url');
  const key = hkdfDerivedKey(authSecret);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
};

export interface OtpAuthParams {
  email: string;
  secret: string;
  issuer: string;
  digits?: number;
  period?: number;
  algorithm?: string;
}

export const buildOtpAuthUrl = (params: OtpAuthParams): string => {
  const digits = params.digits ?? TOTP_DIGITS;
  const period = params.period ?? TOTP_PERIOD_SECONDS;
  const algorithm = params.algorithm ?? TOTP_ALGORITHM;
  const label = `${params.issuer}:${params.email}`;
  const search = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: algorithm.toUpperCase(),
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${search.toString()}`;
};

const hotpCounter = (secret: Buffer, counter: bigint, digits: number): string => {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(counter);
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const code = binCode % 10 ** digits;
  return code.toString().padStart(digits, '0');
};

export const verifyTotp = (
  base32Secret: string,
  code: string,
  options: { now?: Date; window?: number; digits?: number; period?: number } = {},
): boolean => {
  if (!/^\d{6}$/u.test(code)) return false;
  const digits = options.digits ?? TOTP_DIGITS;
  const period = options.period ?? TOTP_PERIOD_SECONDS;
  const window = options.window ?? TOTP_WINDOW;
  const now = options.now ?? new Date();
  const secret = base32Decode(base32Secret);
  const counter = BigInt(Math.floor(now.getTime() / 1000 / period));
  for (let w = -window; w <= window; w++) {
    const candidate = hotpCounter(secret, counter + BigInt(w), digits);
    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(code, 'utf8');
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
};