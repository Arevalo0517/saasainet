import { eq } from 'drizzle-orm';
import type { Database } from '@platform/db';
import { sessions, type Session as DbSession } from '@platform/db';
import type { SessionRecord, SessionRepository } from '@platform/auth';

const toSessionRecord = (row: DbSession): SessionRecord => ({
  id: row.id,
  userId: row.userId,
  platformId: row.platformId,
  refreshTokenHash: row.refreshTokenHash,
  userAgent: row.userAgent,
  ipAddress: row.ipAddress,
  issuedAt: row.issuedAt,
  lastUsedAt: row.lastUsedAt,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt,
  revokedReason: row.revokedReason,
  createdAt: row.createdAt,
});

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async insert(
    input: Omit<SessionRecord, 'id' | 'createdAt' | 'lastUsedAt' | 'revokedAt' | 'revokedReason'>,
  ): Promise<SessionRecord> {
    const rows = await this.db.insert(sessions).values(input as never).returning();
    const row = rows[0];
    if (!row) throw new Error('No se pudo insertar la sesión');
    return toSessionRecord(row);
  }

  async findActiveByRefreshTokenHash(hash: string): Promise<SessionRecord | null> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, hash))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const record = toSessionRecord(row);
    if (record.revokedAt !== null) return null;
    return record;
  }

  async revoke(id: string, reason: string, at: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: at, revokedReason: reason })
      .where(eq(sessions.id, id));
  }

  async touch(id: string, at: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastUsedAt: at })
      .where(eq(sessions.id, id));
  }
}