import { and, asc, desc, eq, isNull, sql, lt, or } from 'drizzle-orm';
import {
  webhookEndpoints,
  webhookEvents,
  webhookDeliveries,
  type WebhookEndpointRecord,
  type WebhookEventRecord,
  type WebhookDeliveryRecord,
  type NewWebhookEndpoint,
  type NewWebhookEvent,
  type NewWebhookDelivery,
} from '@platform/db';
import type { Database } from '@platform/db';

export interface WebhookEndpointListOptions {
  includeArchived?: boolean;
}

export class DrizzleWebhookEndpointsRepository {
  constructor(private readonly db: Database) {}

  async listByClient(clientId: string, opts: WebhookEndpointListOptions = {}): Promise<WebhookEndpointRecord[]> {
    const where = opts.includeArchived === true
      ? eq(webhookEndpoints.clientId, clientId)
      : and(eq(webhookEndpoints.clientId, clientId), isNull(webhookEndpoints.archivedAt));
    return this.db
      .select()
      .from(webhookEndpoints)
      .where(where)
      .orderBy(asc(webhookEndpoints.createdAt));
  }

  async getById(clientId: string, id: string): Promise<WebhookEndpointRecord | null> {
    const rows = await this.db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.clientId, clientId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async getByIdAny(id: string): Promise<WebhookEndpointRecord | null> {
    const rows = await this.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findActiveSubscribers(clientId: string, type: string): Promise<WebhookEndpointRecord[]> {
    return this.db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.clientId, clientId),
          eq(webhookEndpoints.status, 'ACTIVE'),
          isNull(webhookEndpoints.archivedAt),
          sql`${webhookEndpoints.events} @> ${JSON.stringify([type])}::jsonb`,
        ),
      );
  }

  async create(input: NewWebhookEndpoint): Promise<WebhookEndpointRecord> {
    const [row] = await this.db.insert(webhookEndpoints).values(input).returning();
    if (row === undefined) throw new Error('webhook_endpoints insert returned no row');
    return row;
  }

  async update(
    clientId: string,
    id: string,
    patch: Partial<Pick<WebhookEndpointRecord, 'name' | 'url' | 'events' | 'status' | 'description'>>,
  ): Promise<WebhookEndpointRecord> {
    const [row] = await this.db
      .update(webhookEndpoints)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.clientId, clientId)))
      .returning();
    if (row === undefined) throw new Error('webhook_endpoints update returned no row');
    return row;
  }

  async rotateSecret(clientId: string, id: string, secretCiphertext: string): Promise<WebhookEndpointRecord> {
    const [row] = await this.db
      .update(webhookEndpoints)
      .set({ secretCiphertext, updatedAt: new Date() })
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.clientId, clientId)))
      .returning();
    if (row === undefined) throw new Error('webhook_endpoints rotateSecret returned no row');
    return row;
  }

  async archive(clientId: string, id: string): Promise<WebhookEndpointRecord> {
    const [row] = await this.db
      .update(webhookEndpoints)
      .set({ status: 'ARCHIVED', archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.clientId, clientId)))
      .returning();
    if (row === undefined) throw new Error('webhook_endpoints archive returned no row');
    return row;
  }
}

export class DrizzleWebhookEventsRepository {
  constructor(private readonly db: Database) {}

  async findByIdempotencyKey(clientId: string, key: string): Promise<WebhookEventRecord | null> {
    const rows = await this.db
      .select()
      .from(webhookEvents)
      .where(and(eq(webhookEvents.clientId, clientId), eq(webhookEvents.idempotencyKey, key)))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: NewWebhookEvent): Promise<WebhookEventRecord> {
    const [row] = await this.db.insert(webhookEvents).values(input).returning();
    if (row === undefined) throw new Error('webhook_events insert returned no row');
    return row;
  }

  async listByClient(clientId: string, limit: number): Promise<WebhookEventRecord[]> {
    return this.db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.clientId, clientId))
      .orderBy(desc(webhookEvents.occurredAt))
      .limit(limit);
  }
}

export class DrizzleWebhookDeliveriesRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewWebhookDelivery): Promise<WebhookDeliveryRecord> {
    const [row] = await this.db.insert(webhookDeliveries).values(input).returning();
    if (row === undefined) throw new Error('webhook_deliveries insert returned no row');
    return row;
  }

  async createBatch(inputs: NewWebhookDelivery[]): Promise<WebhookDeliveryRecord[]> {
    if (inputs.length === 0) return [];
    return this.db.insert(webhookDeliveries).values(inputs).returning();
  }

  async getById(clientId: string, id: string): Promise<WebhookDeliveryRecord | null> {
    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.id, id), eq(webhookDeliveries.clientId, clientId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByEndpoint(endpointId: string, limit: number): Promise<WebhookDeliveryRecord[]> {
    return this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, endpointId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
  }

  async listPendingForReplay(): Promise<WebhookDeliveryRecord[]> {
    return this.db
      .select()
      .from(webhookDeliveries)
      .where(
        or(
          eq(webhookDeliveries.status, 'PENDING'),
          eq(webhookDeliveries.status, 'IN_FLIGHT'),
        ),
      )
      .orderBy(asc(webhookDeliveries.nextRetryAt));
  }

  async listDueForDelivery(now: Date, limit: number): Promise<WebhookDeliveryRecord[]> {
    return this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          or(eq(webhookDeliveries.status, 'PENDING'), eq(webhookDeliveries.status, 'IN_FLIGHT')),
          or(sql`${webhookDeliveries.nextRetryAt} IS NULL`, lt(webhookDeliveries.nextRetryAt, now)),
        ),
      )
      .orderBy(asc(webhookDeliveries.nextRetryAt))
      .limit(limit);
  }

  async markInFlight(id: string): Promise<WebhookDeliveryRecord> {
    const [row] = await this.db
      .update(webhookDeliveries)
      .set({ status: 'IN_FLIGHT', lastAttemptedAt: new Date(), updatedAt: new Date() })
      .where(eq(webhookDeliveries.id, id))
      .returning();
    if (row === undefined) throw new Error('webhook_deliveries markInFlight returned no row');
    return row;
  }

  async markSucceeded(id: string, statusCode: number, responseBody: string): Promise<WebhookDeliveryRecord> {
    const [row] = await this.db
      .update(webhookDeliveries)
      .set({
        status: 'SUCCEEDED',
        lastStatusCode: String(statusCode),
        responseBody: responseBody.slice(0, 4000),
        lastError: null,
        nextRetryAt: null,
        updatedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, id))
      .returning();
    if (row === undefined) throw new Error('webhook_deliveries markSucceeded returned no row');
    return row;
  }

  async markRetry(
    id: string,
    nextStatus: 'PENDING' | 'DLQ',
    statusCode: number | null,
    error: string,
    responseBody: string | null,
    nextRetryAt: Date | null,
    newAttempt: number,
  ): Promise<WebhookDeliveryRecord> {
    const [row] = await this.db
      .update(webhookDeliveries)
      .set({
        status: nextStatus,
        attemptCount: String(newAttempt),
        lastStatusCode: statusCode === null ? null : String(statusCode),
        lastError: error.slice(0, 1000),
        responseBody: responseBody === null ? null : responseBody.slice(0, 4000),
        nextRetryAt,
        updatedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, id))
      .returning();
    if (row === undefined) throw new Error('webhook_deliveries markRetry returned no row');
    return row;
  }
}

export const WEBHOOK_REPO_TOKENS = {
  ENDPOINTS: Symbol.for('platform.api.webhooks.endpointsRepository'),
  EVENTS: Symbol.for('platform.api.webhooks.eventsRepository'),
  DELIVERIES: Symbol.for('platform.api.webhooks.deliveriesRepository'),
} as const;

export type { WebhookEndpointRecord, WebhookEventRecord, WebhookDeliveryRecord };
