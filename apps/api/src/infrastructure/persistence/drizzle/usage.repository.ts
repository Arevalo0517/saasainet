import { sql } from 'drizzle-orm';
import type { Database } from '@platform/db';
import { usageEvents, type UsageEventRecord, type NewUsageEvent } from '@platform/db';

export interface RecordUsageInput {
  readonly platformId: string;
  readonly distributorId: string;
  readonly clientId: string;
  readonly agentId?: string | null;
  readonly conversationId?: string | null;
  readonly metric: string;
  readonly quantity: number;
  readonly costCents?: number;
  readonly modelProfile?: string | null;
  readonly occurredAt?: Date;
}

export interface UsageAggregateFilter {
  readonly clientId?: string;
  readonly distributorId?: string;
  readonly metric?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly groupBy?: 'agent' | 'channel' | 'client' | 'distributor' | 'day' | 'metric';
}

export interface UsageAggregateRow {
  readonly key: string;
  readonly totalQuantity: number;
  readonly totalCostCents: number;
  readonly eventCount: number;
}

const MAX_RANGE_DAYS = 366;

const validateRange = (from: Date | undefined, to: Date | undefined): void => {
  if (from === undefined || to === undefined) return;
  const diff = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  if (diff > MAX_RANGE_DAYS) {
    throw new Error(`Rango máximo ${MAX_RANGE_DAYS} días`);
  }
};

export class DrizzleUsageEventsRepository {
  constructor(private readonly db: Database) {}

  async record(input: RecordUsageInput): Promise<UsageEventRecord> {
    const row: NewUsageEvent = {
      platformId: input.platformId,
      distributorId: input.distributorId,
      clientId: input.clientId,
      agentId: input.agentId ?? null,
      conversationId: input.conversationId ?? null,
      metric: input.metric,
      quantity: input.quantity,
      costCents: input.costCents ?? 0,
      modelProfile: input.modelProfile ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    };
    const [inserted] = await this.db.insert(usageEvents).values(row).returning();
    if (inserted === undefined) throw new Error('insert failed');
    return inserted;
  }

  async aggregate(filter: UsageAggregateFilter): Promise<{ rows: UsageAggregateRow[]; totals: UsageAggregateRow }> {
    validateRange(filter.from, filter.to);
    const groupBy = filter.groupBy ?? 'day';

    const whereParts: ReturnType<typeof sql>[] = [];
    if (filter.clientId !== undefined) whereParts.push(sql`client_id = ${filter.clientId}`);
    if (filter.distributorId !== undefined) whereParts.push(sql`distributor_id = ${filter.distributorId}`);
    if (filter.metric !== undefined) whereParts.push(sql`metric = ${filter.metric}`);
    if (filter.from !== undefined) whereParts.push(sql`occurred_at >= ${filter.from.toISOString()}`);
    if (filter.to !== undefined) whereParts.push(sql`occurred_at <= ${filter.to.toISOString()}`);
    const where = whereParts.length === 0 ? sql`TRUE` : sql.join(whereParts, sql` AND `);

    const groupKey = (() => {
      switch (groupBy) {
        case 'agent':
          return sql`COALESCE(agent_id::text, '__none__')`;
        case 'channel':
          return sql`COALESCE(channel, '__none__')`;
        case 'client':
          return sql`client_id::text`;
        case 'distributor':
          return sql`distributor_id::text`;
        case 'metric':
          return sql`metric`;
        case 'day':
        default:
          return sql`to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD')`;
      }
    })();

    const rowsSql = sql`
      SELECT ${groupKey} AS key,
             SUM(quantity)::bigint AS total_quantity,
             SUM(cost_cents)::bigint AS total_cost_cents,
             COUNT(*)::bigint AS event_count
      FROM usage_events
      WHERE ${where}
      GROUP BY ${groupKey}
      ORDER BY ${groupKey} ASC
    `;
    const totalsSql = sql`
      SELECT COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
             COALESCE(SUM(cost_cents), 0)::bigint AS total_cost_cents,
             COUNT(*)::bigint AS event_count
      FROM usage_events
      WHERE ${where}
    `;
    const [rows, totals] = await Promise.all([this.db.execute<{ key: string; total_quantity: string; total_cost_cents: string; event_count: string }>(rowsSql), this.db.execute<{ total_quantity: string; total_cost_cents: string; event_count: string }>(totalsSql)]);

    const toRow = (r: { key?: string; total_quantity: string; total_cost_cents: string; event_count: string }): UsageAggregateRow => ({
      key: r.key ?? '__all__',
      totalQuantity: Number(r.total_quantity),
      totalCostCents: Number(r.total_cost_cents),
      eventCount: Number(r.event_count),
    });

    return {
      rows: rows.map((r) => toRow(r)),
      totals: toRow(totals[0] ?? { total_quantity: '0', total_cost_cents: '0', event_count: '0' }),
    };
  }
}
