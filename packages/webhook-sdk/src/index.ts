import { createHmac, timingSafeEqual } from 'node:crypto';

export type WebhookEventType =
  | 'conversation.started'
  | 'conversation.closed'
  | 'human.reply.created'
  | 'agent.published';

export interface WebhookPayload<T = unknown> {
  eventId: string;
  eventType: WebhookEventType;
  occurredAt: string;
  platformId: string;
  distributorId?: string | null;
  clientId?: string | null;
  apiVersion: string;
  data: T;
}

export interface DispatchWebhookInput {
  endpointId: string;
  url: string;
  secret: string;
  payload: WebhookPayload;
  attempt: number;
}

export interface DispatchWebhookResult {
  status: 'DELIVERED' | 'RETRY' | 'DLQ';
  httpStatus?: number;
  error?: string;
}

export interface HttpDeliveryRequest {
  url: string;
  body: string;
  signature: string;
  timestamp: string;
  eventId: string;
  eventType: string;
  attempt: number;
}

export interface HttpDeliveryResponse {
  statusCode: number;
  body: string;
}

export interface HttpDeliveryClient {
  post(req: HttpDeliveryRequest): Promise<HttpDeliveryResponse>;
}

export const signBody = (body: string, secret: string, timestamp: string): string =>
  createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

export const verifySignature = (body: string, secret: string, timestamp: string, signature: string): boolean => {
  const expected = signBody(body, secret, timestamp);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
};

export const RETRY_BACKOFF_MS = [0, 60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000] as const;

export const computeNextRetry = (attempt: number): { status: 'PENDING' | 'DLQ'; delayMs: number | null } => {
  const nextIndex = attempt;
  if (nextIndex >= RETRY_BACKOFF_MS.length) return { status: 'DLQ', delayMs: null };
  return { status: 'PENDING', delayMs: RETRY_BACKOFF_MS[nextIndex] ?? 0 };
};

const SUCCESS_MAX = 299;

export const DEFAULT_DISPATCHER_TIMEOUT_MS = 10_000;

export class HttpWebhookDispatcher {
  constructor(
    private readonly client: HttpDeliveryClient,
    private readonly timeoutMs: number = DEFAULT_DISPATCHER_TIMEOUT_MS,
  ) {}

  async dispatch(input: DispatchWebhookInput): Promise<DispatchWebhookResult> {
    const body = JSON.stringify(input.payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signBody(body, input.secret, timestamp);

    let res: HttpDeliveryResponse;
    try {
      res = await this.client.post({
        url: input.url,
        body,
        signature,
        timestamp,
        eventId: input.payload.eventId,
        eventType: input.payload.eventType,
        attempt: input.attempt,
      });
    } catch (err) {
      return { status: 'RETRY', error: (err as Error).message };
    }

    if (res.statusCode >= 200 && res.statusCode <= SUCCESS_MAX) {
      return { status: 'DELIVERED', httpStatus: res.statusCode };
    }
    if (res.statusCode === 410 || res.statusCode === 404) {
      return { status: 'DLQ', httpStatus: res.statusCode, error: `http ${res.statusCode} (gone)` };
    }
    return { status: 'RETRY', httpStatus: res.statusCode, error: `http ${res.statusCode}` };
  }
}

export const PLACEHOLDER = 'Implementación en Fase 6.';

void DEFAULT_DISPATCHER_TIMEOUT_MS;
