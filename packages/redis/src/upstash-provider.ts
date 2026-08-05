import { Redis } from '@upstash/redis';
import type { RedisProvider, RedisValue } from './redis-provider.js';

export class UpstashRedisProvider implements RedisProvider {
  private client: Redis;

  constructor(url: string, token: string) {
    this.client = new Redis({ url, token });
  }

  async get(key: string): Promise<string | null> {
    const v = await this.client.get<string>(key);
    return v ?? null;
  }

  async set(key: string, value: RedisValue, options?: { ex?: number; nx?: boolean }): Promise<'OK' | null> {
    let res: 'OK' | null;
    if (options?.ex !== undefined && options?.nx === true) {
      res = (await this.client.set(key, value as string, { ex: options.ex, nx: true })) as 'OK' | null;
    } else if (options?.ex !== undefined) {
      res = (await this.client.set(key, value as string, { ex: options.ex })) as 'OK' | null;
    } else if (options?.nx === true) {
      res = (await this.client.set(key, value as string, { nx: true })) as 'OK' | null;
    } else {
      res = (await this.client.set(key, value as string)) as 'OK' | null;
    }
    return res;
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}
