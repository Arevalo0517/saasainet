export type RedisValue = string | number | boolean | null | Buffer;

export interface RedisProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: RedisValue, options?: { ex?: number; nx?: boolean }): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ping(): Promise<string>;
}

let cached: RedisProvider | null = null;

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

export const initRedisProvider = async (): Promise<RedisProvider> => {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    const { UpstashRedisProvider } = await import('./upstash-provider.js');
    cached = new UpstashRedisProvider(url, token);
  } else {
    const { InMemoryRedisProvider } = await import('./memory-provider.js');
    cached = new InMemoryRedisProvider();
  }
  await cached.ping();
  return cached;
};

export const getRedisProvider = (): RedisProvider => {
  if (!cached) throw new Error('Redis provider not initialized. Call initRedisProvider() first.');
  return cached;
};

export const resetRedisProvider = (): void => {
  cached = null;
};

// Re-exported for typed access
export const redisEnv = { required };
