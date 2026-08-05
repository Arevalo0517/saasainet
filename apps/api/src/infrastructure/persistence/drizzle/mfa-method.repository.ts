import { and, eq } from 'drizzle-orm';
import type { Database } from '@platform/db';
import { mfaMethods, type MfaMethod as DbMfaMethod } from '@platform/db';
import type { MfaMethodRecord, MfaMethodRepository } from '@platform/auth';

const toMfaMethodRecord = (row: DbMfaMethod): MfaMethodRecord => ({
  id: row.id,
  userId: row.userId,
  type: row.type,
  status: row.status,
  secretEncrypted: row.secretEncrypted,
  destination: row.destination,
  isPrimary: row.isPrimary,
  verifiedAt: row.verifiedAt,
  lastUsedAt: row.lastUsedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class DrizzleMfaMethodRepository implements MfaMethodRepository {
  constructor(private readonly db: Database) {}

  async insert(
    input: Omit<MfaMethodRecord, 'id' | 'createdAt' | 'updatedAt' | 'verifiedAt' | 'lastUsedAt'>,
  ): Promise<MfaMethodRecord> {
    const rows = await this.db.insert(mfaMethods).values(input as never).returning();
    const row = rows[0];
    if (!row) throw new Error('No se pudo insertar el método MFA');
    return toMfaMethodRecord(row);
  }

  async findById(id: string): Promise<MfaMethodRecord | null> {
    const rows = await this.db
      .select()
      .from(mfaMethods)
      .where(eq(mfaMethods.id, id))
      .limit(1);
    const row = rows[0];
    return row ? toMfaMethodRecord(row) : null;
  }

  async findPrimaryActiveByUserId(userId: string): Promise<MfaMethodRecord | null> {
    const rows = await this.db
      .select()
      .from(mfaMethods)
      .where(
        and(
          eq(mfaMethods.userId, userId),
          eq(mfaMethods.isPrimary, true),
          eq(mfaMethods.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? toMfaMethodRecord(row) : null;
  }

  async activate(id: string, at: Date): Promise<void> {
    await this.db
      .update(mfaMethods)
      .set({ status: 'ACTIVE', verifiedAt: at, updatedAt: at })
      .where(eq(mfaMethods.id, id));
  }

  async setLastUsed(id: string, at: Date): Promise<void> {
    await this.db
      .update(mfaMethods)
      .set({ lastUsedAt: at, updatedAt: at })
      .where(eq(mfaMethods.id, id));
  }
}