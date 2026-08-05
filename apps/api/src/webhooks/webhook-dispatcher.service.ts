import type { TenantContext } from '@platform/contracts';
import { computeNextRetry, signBody, type HttpDeliveryClient, type WebhookPayload } from '@platform/webhook-sdk';
import { resolveAndCheck, type CheckResult } from '@platform/url-safety';
import { decryptWebhookSecret } from './webhook-endpoints.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  DrizzleWebhookEndpointsRepository,
  DrizzleWebhookEventsRepository,
  DrizzleWebhookDeliveriesRepository,
  type WebhookEventRecord,
  type WebhookDeliveryRecord,
} from '../infrastructure/persistence/drizzle/webhooks.repository.js';
import { WEBHOOK_NOT_FOUND } from './webhooks.errors.js';

export const buildPayload = (e: WebhookEventRecord): WebhookPayload => ({
  eventId: e.id,
  eventType: e.type as WebhookPayload['eventType'],
  occurredAt: e.occurredAt.toISOString(),
  platformId: e.platformId,
  distributorId: e.distributorId,
  clientId: e.clientId,
  apiVersion: 'v1',
  data: e.payload,
});

export type UrlSafetyChecker = (
  url: string,
  options: { allowlist: readonly string[]; allowPrivateNetwork: boolean },
) => Promise<CheckResult>;

export const defaultUrlSafetyChecker: UrlSafetyChecker = async (url, options) => {
  return resolveAndCheck(url, { allowlist: options.allowlist, allowPrivateNetwork: options.allowPrivateNetwork });
};

export interface DispatcherDeps {
  endpoints: DrizzleWebhookEndpointsRepository;
  events: DrizzleWebhookEventsRepository;
  deliveries: DrizzleWebhookDeliveriesRepository;
  http: HttpDeliveryClient;
  urlSafety: UrlSafetyChecker;
  getClientAllowlist: (clientId: string) => Promise<readonly string[]>;
}

export class WebhookDispatcherService {
  constructor(private readonly deps: DispatcherDeps) {}

  async emit(
    ctx: Pick<TenantContext, 'platformId' | 'distributorId' | 'clientId'>,
    type: WebhookPayload['eventType'],
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<WebhookEventRecord | null> {
    const existing = await this.deps.events.findByIdempotencyKey(ctx.clientId as string, idempotencyKey);
    if (existing !== null) return null;

    const event = await this.deps.events.create({
      platformId: ctx.platformId,
      distributorId: ctx.distributorId as string,
      clientId: ctx.clientId as string,
      type,
      idempotencyKey,
      payload,
    });

    const subscribers = await this.deps.endpoints.findActiveSubscribers(ctx.clientId as string, type);
    if (subscribers.length === 0) return event;

    const fullPayload = buildPayload(event);
    const body = JSON.stringify(fullPayload);
    const ts = String(Math.floor(Date.now() / 1000));

    const newDeliveries: WebhookDeliveryRecord[] = [];
    for (const ep of subscribers) {
      const sig = signBody(body, decryptWebhookSecret(ep.secretCiphertext, ep.id), ts);
      const [created] = await this.deps.deliveries.createBatch([
        {
          platformId: ep.platformId,
          distributorId: ep.distributorId,
          clientId: ep.clientId,
          endpointId: ep.id,
          eventId: event.id,
          status: 'PENDING',
          attemptCount: '0',
          maxAttempts: '6',
          requestBody: body,
          requestSignature: sig,
          nextRetryAt: new Date(),
        },
      ]);
      if (created !== undefined) newDeliveries.push(created);
    }
    return event;
  }

  async processDue(limit: number): Promise<number> {
    const now = new Date();
    const due = await this.deps.deliveries.listDueForDelivery(now, limit);
    let processed = 0;
    for (const d of due) {
      await this.attemptDelivery(d);
      processed += 1;
    }
    return processed;
  }

  async attemptDelivery(d: WebhookDeliveryRecord): Promise<WebhookDeliveryRecord> {
    await this.deps.deliveries.markInFlight(d.id);
    const ep = await this.deps.endpoints.getByIdAny(d.endpointId);
    if (ep === null || ep.status !== 'ACTIVE' || ep.archivedAt !== null) {
      return this.deps.deliveries.markRetry(
        d.id, 'DLQ', null, 'endpoint no disponible', null, null, Number(d.attemptCount) + 1,
      );
    }
    const allowlist = await this.deps.getClientAllowlist(ep.clientId);
    const safety = await this.deps.urlSafety(ep.url, { allowlist, allowPrivateNetwork: false });
    if (!safety.ok) {
      return this.deps.deliveries.markRetry(
        d.id,
        'DLQ',
        null,
        `URL bloqueada por política de seguridad (${safety.code}): ${safety.message.slice(0, 500)}`,
        null,
        null,
        Number(d.attemptCount) + 1,
      );
    }
    const body = d.requestBody;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signBody(body, decryptWebhookSecret(ep.secretCiphertext, ep.id), timestamp);

    let res: { statusCode: number; body: string };
    try {
      res = await this.deps.http.post({
        url: ep.url,
        body,
        signature,
        timestamp,
        eventId: d.eventId,
        eventType: '',
        attempt: Number(d.attemptCount) + 1,
      });
    } catch (err) {
      const next = computeNextRetry(Number(d.attemptCount) + 1);
      const nextRetryAt = next.delayMs === null ? null : new Date(Date.now() + (next.delayMs ?? 0));
      return this.deps.deliveries.markRetry(
        d.id, next.status, null, (err as Error).message.slice(0, 1000), null, nextRetryAt, Number(d.attemptCount) + 1,
      );
    }

    if (res.statusCode >= 200 && res.statusCode <= 299) {
      return this.deps.deliveries.markSucceeded(d.id, res.statusCode, res.body);
    }
    if (res.statusCode === 410 || res.statusCode === 404) {
      return this.deps.deliveries.markRetry(
        d.id, 'DLQ', res.statusCode, `http ${res.statusCode} (gone)`, res.body, null, Number(d.attemptCount) + 1,
      );
    }
    const next = computeNextRetry(Number(d.attemptCount) + 1);
    const nextRetryAt = next.delayMs === null ? null : new Date(Date.now() + (next.delayMs ?? 0));
    return this.deps.deliveries.markRetry(
      d.id, next.status, res.statusCode, `http ${res.statusCode}`, res.body, nextRetryAt, Number(d.attemptCount) + 1,
    );
  }

  async replay(ctx: TenantContext, deliveryId: string): Promise<WebhookDeliveryRecord> {
    const d = await this.deps.deliveries.getById(ctx.clientId as string, deliveryId);
    if (d === null) throw WEBHOOK_NOT_FOUND(deliveryId);
    if (d.status === 'SUCCEEDED' || d.status === 'IN_FLIGHT') return d;
    return this.attemptDelivery(d);
  }

  async listDeliveries(endpointId: string, limit: number): Promise<WebhookDeliveryRecord[]> {
    return this.deps.deliveries.listByEndpoint(endpointId, limit);
  }

  async getDelivery(ctx: TenantContext, id: string): Promise<WebhookDeliveryRecord> {
    const d = await this.deps.deliveries.getById(ctx.clientId as string, id);
    if (d === null) throw WEBHOOK_NOT_FOUND(id);
    return d;
  }
}
