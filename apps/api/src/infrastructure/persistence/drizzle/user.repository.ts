import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '@platform/db';
import { users, type User as DbUser } from '@platform/db';
import type { UserRecord, UserRepository } from '@platform/auth';

const toUserRecord = (row: DbUser): UserRecord => ({
  id: row.id,
  platformId: row.platformId,
  email: row.email,
  emailNormalized: row.emailNormalized,
  passwordHash: row.passwordHash,
  fullName: row.fullName,
  locale: row.locale,
  status: row.status,
  emailVerifiedAt: row.emailVerifiedAt,
  lastLoginAt: row.lastLoginAt,
  failedLoginAttempts: row.failedLoginAttempts,
  lockedUntil: row.lockedUntil,
  passwordChangedAt: row.passwordChangedAt,
  mfaEnabled: row.mfaEnabled,
  isPlatformSuperAdmin: row.isPlatformSuperAdmin,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<UserRecord | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    const row = rows[0];
    return row ? toUserRecord(row) : null;
  }

  async findByEmailNormalized(platformId: string, emailNormalized: string): Promise<UserRecord | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.platformId, platformId), eq(users.emailNormalized, emailNormalized)))
      .limit(1);
    const row = rows[0];
    return row ? toUserRecord(row) : null;
  }

  async incrementFailedLogin(id: string): Promise<UserRecord> {
    const rows = await this.db
      .update(users)
      .set({ failedLoginAttempts: sql`${users.failedLoginAttempts} + 1`, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new Error(`User ${id} no existe`);
    return toUserRecord(row);
  }

  async resetFailedLogin(id: string, when: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: when })
      .where(eq(users.id, id));
  }

  async lockUntil(id: string, until: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ lockedUntil: until, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async setLastLogin(id: string, when: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: when, updatedAt: when })
      .where(eq(users.id, id));
  }

  async setMfaEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db
      .update(users)
      .set({ mfaEnabled: enabled, updatedAt: new Date() })
      .where(eq(users.id, id));
  }
}