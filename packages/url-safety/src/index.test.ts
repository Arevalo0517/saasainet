import { describe, expect, it } from 'vitest';
import { isPrivateIP, resolveAndCheck, type LookupResolver } from './index.js';

const fixedResolver = (ips: readonly string[]): LookupResolver => {
  return async (_hostname: string): Promise<readonly string[]> => ips;
};

const failingResolver: LookupResolver = async (_hostname: string): Promise<readonly string[]> => {
  throw new Error('ENOTFOUND');
};

describe('isPrivateIP', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '192.168.255.255',
    '169.254.169.254',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
  ])('blocks IPv4 private %s', (ip) => {
    expect(isPrivateIP(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '203.0.113.5', '93.184.216.34'])('allows public IPv4 %s', (ip) => {
    expect(isPrivateIP(ip)).toBe(false);
  });

  it.each(['::1', 'fc00::1', 'fd00::1', 'fe80::1', 'ff00::1', '::'])('blocks IPv6 private %s', (ip) => {
    expect(isPrivateIP(ip)).toBe(true);
  });

  it.each(['2606:4700:4700::1111', '2001:4860:4860::8888'])('allows public IPv6 %s', (ip) => {
    expect(isPrivateIP(ip)).toBe(false);
  });

  it('blocks IPv4-mapped IPv6 ::ffff:127.0.0.1', () => {
    expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
  });
});

describe('resolveAndCheck', () => {
  it('rejects invalid url', async () => {
    const r = await resolveAndCheck('not a url', { resolver: fixedResolver([]) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_INVALID');
  });

  it('rejects non-http(s) schemes', async () => {
    const r = await resolveAndCheck('file:///etc/passwd', { resolver: fixedResolver([]) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_INVALID_SCHEME');
  });

  it('blocks localhost literal', async () => {
    const r = await resolveAndCheck('http://localhost/x', { resolver: fixedResolver(['127.0.0.1']) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_HOST_BLOCKED');
  });

  it('blocks private IPv4 resolved', async () => {
    const r = await resolveAndCheck('https://hooks.example.com/x', {
      resolver: fixedResolver(['10.0.0.5']),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_PRIVATE_IP');
  });

  it('blocks 169.254.169.254 (cloud metadata)', async () => {
    const r = await resolveAndCheck('https://example.com/x', {
      resolver: fixedResolver(['169.254.169.254']),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_PRIVATE_IP');
  });

  it('blocks IPv6 private', async () => {
    const r = await resolveAndCheck('https://example.com/x', {
      resolver: fixedResolver(['fc00::1']),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_PRIVATE_IP');
  });

  it('allows public IP', async () => {
    const r = await resolveAndCheck('https://hooks.example.com/x', {
      resolver: fixedResolver(['93.184.216.34']),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ips).toEqual(['93.184.216.34']);
  });

  it('blocks if ANY resolved IP is private (multi-A record attack)', async () => {
    const r = await resolveAndCheck('https://hooks.example.com/x', {
      resolver: fixedResolver(['1.1.1.1', '10.0.0.5']),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_PRIVATE_IP');
  });

  it('rejects on DNS failure', async () => {
    const r = await resolveAndCheck('https://hooks.example.com/x', { resolver: failingResolver });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DNS_LOOKUP_FAILED');
  });

  it('rejects on empty DNS result', async () => {
    const r = await resolveAndCheck('https://hooks.example.com/x', { resolver: fixedResolver([]) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DNS_LOOKUP_FAILED');
  });

  it('honors allowlist (exact host)', async () => {
    const r = await resolveAndCheck('https://hooks.example.com/x', {
      allowlist: ['hooks.example.com'],
      resolver: fixedResolver(['1.1.1.1']),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.matchedRule).toBe('hooks.example.com');
  });

  it('honors allowlist (wildcard subdomain)', async () => {
    const r = await resolveAndCheck('https://a.b.example.com/x', {
      allowlist: ['*.example.com'],
      resolver: fixedResolver(['1.1.1.1']),
    });
    expect(r.ok).toBe(true);
  });

  it('rejects host not in allowlist (even with public IP)', async () => {
    const r = await resolveAndCheck('https://evil.com/x', {
      allowlist: ['example.com'],
      resolver: fixedResolver(['1.1.1.1']),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_NOT_IN_ALLOWLIST');
  });

  it('allowPrivateNetwork skips private IP check', async () => {
    const r = await resolveAndCheck('https://hooks.example.com/x', {
      allowlist: ['hooks.example.com'],
      allowPrivateNetwork: true,
      resolver: fixedResolver(['10.0.0.1']),
    });
    expect(r.ok).toBe(true);
  });

  it('requireHttps blocks http when set', async () => {
    const r = await resolveAndCheck('http://example.com/x', {
      requireHttps: true,
      resolver: fixedResolver(['1.1.1.1']),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_NOT_HTTPS');
  });
});
