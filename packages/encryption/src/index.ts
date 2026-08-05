import { createCipheriv, createDecipheriv, randomBytes, type CipherGCM, type DecipherGCM } from 'node:crypto';

const ALGO = 'aes-256-gcm' as const;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const SEPARATOR = '.';

let cachedKey: Buffer | null = null;

const loadKey = (): Buffer => {
  if (cachedKey !== null) return cachedKey;
  const raw = process.env.PLATFORM_ENCRYPTION_KEY;
  if (raw === undefined || raw.length === 0) {
    throw new Error(
      'PLATFORM_ENCRYPTION_KEY is required (32 bytes hex-encoded, e.g. crypto.randomBytes(32).toString("hex"))',
    );
  }
  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `PLATFORM_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length})`,
    );
  }
  cachedKey = buf;
  return buf;
};

export const resetEncryptionKeyCache = (): void => {
  cachedKey = null;
};

export const setEncryptionKeyForTests = (key: Buffer): void => {
  if (key.length !== KEY_BYTES) throw new Error(`key must be ${KEY_BYTES} bytes`);
  cachedKey = Buffer.from(key);
};

export interface EncryptedBlob {
  readonly iv: string;
  readonly tag: string;
  readonly ciphertext: string;
}

const encrypt = (plaintext: string, aad?: string): EncryptedBlob => {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher: CipherGCM = createCipheriv(ALGO, key, iv);
  if (aad !== undefined) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: enc.toString('base64'),
  };
};

const decrypt = (blob: EncryptedBlob, aad?: string): string => {
  const key = loadKey();
  const iv = Buffer.from(blob.iv, 'base64');
  const tag = Buffer.from(blob.tag, 'base64');
  const enc = Buffer.from(blob.ciphertext, 'base64');
  if (iv.length !== IV_BYTES) throw new Error(`invalid IV length: ${iv.length}`);
  if (tag.length !== TAG_BYTES) throw new Error(`invalid tag length: ${tag.length}`);
  const decipher: DecipherGCM = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  if (aad !== undefined) decipher.setAAD(Buffer.from(aad, 'utf8'));
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
};

const encode = (blob: EncryptedBlob): string => `${blob.iv}${SEPARATOR}${blob.tag}${SEPARATOR}${blob.ciphertext}`;

const decode = (encoded: string): EncryptedBlob => {
  const parts = encoded.split(SEPARATOR);
  if (parts.length !== 3) {
    throw new Error(`invalid ciphertext format: expected 3 parts, got ${parts.length}`);
  }
  const [iv, tag, ciphertext] = parts as [string, string, string];
  return { iv, tag, ciphertext };
};

export const encryptString = (plaintext: string, aad?: string): string => encode(encrypt(plaintext, aad));

export const decryptString = (encoded: string, aad?: string): string => decrypt(decode(encoded), aad);

export const encryptJson = <T>(value: T, aad?: string): string =>
  encryptString(JSON.stringify(value), aad);

export const decryptJson = <T>(encoded: string, aad?: string): T =>
  JSON.parse(decryptString(encoded, aad)) as T;

export const isEncryptedString = (value: string): boolean => {
  const parts = value.split(SEPARATOR);
  if (parts.length !== 3) return false;
  const [iv, tag, ct] = parts as [string, string, string];
  return /^[A-Za-z0-9+/]+=*$/.test(iv) && /^[A-Za-z0-9+/]+=*$/.test(tag) && /^[A-Za-z0-9+/]+=*$/.test(ct);
};
