import type { RedisProvider, RedisValue } from './redis-provider.js';

interface Entry {
  value: string;
  expiresAt: number | null;
}

export class InMemoryRedisProvider implements RedisProvider {
  private store = new Map<string, Entry>();

  private isExpired(entry: Entry): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: RedisValue, options?: { ex?: number; nx?: boolean }): Promise<'OK' | null> {
    if (options?.nx && this.store.has(key)) {
      const existing = this.store.get(key);
      if (existing && !this.isExpired(existing)) return null;
    }
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : null;
    this.store.set(key, { value: value === null ? '' : String(value), expiresAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return 0;
    }
    return 1;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next = (current ? Number(current) : 0) + 1;
    await this.set(key, String(next));
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }
}
