import { describe, expect, it } from 'vitest';
import {
  checkUrlAgainstAllowlist,
  HostnameValidationError,
  isAlwaysBlockedLiteral,
  isPrivateHostLiteral,
  normalizeHostList,
  normalizeHostname,
} from './hostnames.js';

describe('normalizeHostname', () => {
  it('lowercases and strips dots', () => {
    expect(normalizeHostname('  Example.COM. ')).toEqual({
      input: '  Example.COM. ',
      host: 'example.com',
      wildcard: false,
    });
  });

  it('detects wildcard prefix', () => {
    const n = normalizeHostname('*.hooks.example.com');
    expect(n?.wildcard).toBe(true);
    expect(n?.host).toBe('hooks.example.com');
  });

  it('rejects schemes / paths / query', () => {
    expect(normalizeHostname('https://example.com')).toBeNull();
    expect(normalizeHostname('example.com/path')).toBeNull();
    expect(normalizeHostname('example.com?q=1')).toBeNull();
  });

  it('strips valid ports', () => {
    expect(normalizeHostname('example.com:8080')).toEqual({
      input: 'example.com:8080',
      host: 'example.com',
      wildcard: false,
    });
  });

  it('rejects invalid labels', () => {
    expect(normalizeHostname('-bad.com')).toBeNull();
    expect(normalizeHostname('bad-.com')).toBeNull();
    expect(normalizeHostname('a..b.com')).toBeNull();
    expect(normalizeHostname(`${'a'.repeat(64)}.com`)).toBeNull();
  });

  it('rejects too-long hostnames', () => {
    const long = `${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.example.com`;
    expect(normalizeHostname(long)).toBeNull();
  });
});

describe('normalizeHostList', () => {
  it('dedupes and preserves wildcard ordering', () => {
    const out = normalizeHostList(['Example.com', '*.hooks.example.com', 'example.com', '*.HOOKS.example.com']);
    expect(out).toEqual(['example.com', '*.hooks.example.com']);
  });

  it('throws on invalid entry', () => {
    expect(() => normalizeHostList(['ok.com', 'bad host'])).toThrow(HostnameValidationError);
  });

  it('enforces max size', () => {
    const arr = Array.from({ length: 201 }, (_, i) => `h${i}.example.com`);
    expect(() => normalizeHostList(arr)).toThrow(/WEBHOOK_ALLOWLIST_TOO_LARGE/);
  });
});

describe('isAlwaysBlockedLiteral / isPrivateHostLiteral', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.5',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '::1',
    'fc00::1',
    'fe80::1',
  ])('isPrivateHostLiteral blocks %s', (h) => {
    expect(isPrivateHostLiteral(h)).toBe(true);
    expect(isAlwaysBlockedLiteral(h)).toBe(true);
  });

  it('isAlwaysBlockedLiteral also blocks name literals like localhost and metadata', () => {
    expect(isAlwaysBlockedLiteral('localhost')).toBe(true);
    expect(isAlwaysBlockedLiteral('metadata.google.internal')).toBe(true);
    expect(isPrivateHostLiteral('localhost')).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '203.0.113.5'])('does not block public %s', (h) => {
    expect(isAlwaysBlockedLiteral(h)).toBe(false);
    expect(isPrivateHostLiteral(h)).toBe(false);
  });
});

describe('checkUrlAgainstAllowlist', () => {
  it('rejects invalid url', () => {
    expect(checkUrlAgainstAllowlist('not a url', []).ok).toBe(false);
  });

  it('rejects non-http(s) schemes', () => {
    expect(checkUrlAgainstAllowlist('file:///etc/passwd', []).code).toBe('WEBHOOK_URL_INVALID_SCHEME');
  });

  it('blocks localhost literal even with empty allowlist', () => {
    expect(checkUrlAgainstAllowlist('http://localhost:3000/x', []).code).toBe('WEBHOOK_URL_BLOCKED_HOST');
    expect(checkUrlAgainstAllowlist('http://127.0.0.1/x', []).code).toBe('WEBHOOK_URL_BLOCKED_HOST');
    expect(checkUrlAgainstAllowlist('http://169.254.169.254/x', []).code).toBe('WEBHOOK_URL_BLOCKED_HOST');
  });

  it('with empty allowlist requires https', () => {
    expect(checkUrlAgainstAllowlist('http://example.com/x', []).code).toBe('WEBHOOK_URL_NOT_HTTPS');
    expect(checkUrlAgainstAllowlist('https://example.com/x', []).ok).toBe(true);
  });

  it('matches exact host in allowlist', () => {
    expect(checkUrlAgainstAllowlist('https://hooks.example.com/x', ['hooks.example.com']).ok).toBe(true);
    expect(checkUrlAgainstAllowlist('https://other.com/x', ['hooks.example.com']).code).toBe(
      'WEBHOOK_URL_NOT_IN_ALLOWLIST',
    );
  });

  it('matches wildcard subdomain only for subdomains', () => {
    const allow = ['*.example.com'];
    expect(checkUrlAgainstAllowlist('https://a.example.com/x', allow).ok).toBe(true);
    expect(checkUrlAgainstAllowlist('https://a.b.example.com/x', allow).ok).toBe(true);
    expect(checkUrlAgainstAllowlist('https://example.com/x', allow).ok).toBe(false);
    expect(checkUrlAgainstAllowlist('https://evil.com/x?next=example.com', allow).ok).toBe(false);
  });
});
