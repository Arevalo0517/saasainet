import { describe, it, expect } from 'vitest';
import { InMemoryRedisProvider } from '../src/memory-provider.js';

describe('InMemoryRedisProvider', () => {
  it('sets, gets and deletes', async () => {
    const r = new InMemoryRedisProvider();
    await r.set('k', 'v');
    expect(await r.get('k')).toBe('v');
    expect(await r.del('k')).toBe(1);
    expect(await r.get('k')).toBeNull();
  });

  it('respects ex option', async () => {
    const r = new InMemoryRedisProvider();
    await r.set('k', 'v', { ex: 1 });
    expect(await r.get('k')).toBe('v');
    await new Promise((res) => setTimeout(res, 1100));
    expect(await r.get('k')).toBeNull();
  });

  it('respects nx option', async () => {
    const r = new InMemoryRedisProvider();
    expect(await r.set('k', '1', { nx: true })).toBe('OK');
    expect(await r.set('k', '2', { nx: true })).toBeNull();
    expect(await r.get('k')).toBe('1');
  });

  it('incr returns next value', async () => {
    const r = new InMemoryRedisProvider();
    expect(await r.incr('k')).toBe(1);
    expect(await r.incr('k')).toBe(2);
  });

  it('redis provider ping works', async () => {
    const r = new InMemoryRedisProvider();
    expect(await r.ping()).toBe('PONG');
  });
});
