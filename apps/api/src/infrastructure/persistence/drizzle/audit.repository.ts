import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { Database } from '@platform/db';
import { auditEvents, type AuditEventRecord } from '@platform/db';

export interface AuditEventFilters {
  readonly clientId?: string;
  readonly action?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly actorUserId?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
  readonly offset?: number;
}

export interface AuditQueryResult {
  readonly items: AuditEventRecord[];
  readonly total: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export class DrizzleAuditEventsRepository {
  constructor(private readonly db: Database) {}

  async record(input: typeof auditEvents.$inferInsert): Promise<AuditEventRecord> {
    const rows = await this.db.insert(auditEvents).values(input).returning();
    const row = rows[0];
    if (row === undefined) throw new Error('audit_events insert returned no row');
    return row;
  }

  async query(filters: AuditEventFilters): Promise<AuditQueryResult> {
    const conds: SQL[] = [];
    if (filters.clientId !== undefined) conds.push(eq(auditEvents.clientId, filters.clientId));
    if (filters.action !== undefined) conds.push(eq(auditEvents.action, filters.action));
    if (filters.resourceType !== undefined) conds.push(eq(auditEvents.resourceType, filters.resourceType));
    if (filters.resourceId !== undefined) conds.push(eq(auditEvents.resourceId, filters.resourceId));
    if (filters.actorUserId !== undefined) conds.push(eq(auditEvents.actorUserId, filters.actorUserId));
    if (filters.from !== undefined) conds.push(gte(auditEvents.createdAt, filters.from));
    if (filters.to !== undefined) conds.push(lte(auditEvents.createdAt, filters.to));

    const where = conds.length === 0 ? undefined : and(...conds);
    const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(filters.offset ?? 0, 0);

    const countRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(where);
    const total = countRows[0]?.count ?? 0;

    const items = await this.db
      .select()
      .from(auditEvents)
      .where(where)
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, total };
  }
}
