import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

let cachedDb: Database | null = null;
let cachedSql: ReturnType<typeof postgres> | null = null;

export const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  return url;
};

export const createDatabase = (url?: string): Database => {
  const sql = postgres(url ?? getDatabaseUrl(), {
    ssl: 'require',
    max: 10,
    idle_timeout: 30,
    prepare: false,
  });
  return drizzle(sql, { schema });
};

export const getDatabase = (): Database => {
  if (!cachedDb) {
    cachedSql = postgres(getDatabaseUrl(), {
      ssl: 'require',
      max: 10,
      idle_timeout: 30,
      prepare: false,
    });
    cachedDb = drizzle(cachedSql, { schema });
  }
  return cachedDb;
};

export const closeDatabase = async (): Promise<void> => {
  if (cachedSql) {
    await cachedSql.end({ timeout: 5 });
    cachedSql = null;
    cachedDb = null;
  }
};
