import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Currency, PaymentStatus } from '@platform/contracts';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  NormalizedWebhookEvent,
  PaymentProvider,
  VerifyWebhookInput,
} from './index.js';

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  constructor(private readonly secret: string) {
    if (secret.length < 16) {
      throw new Error('MockPaymentProvider secret must be >= 16 chars');
    }
  }

  signBody(rawBody: string): string {
    return createHmac('sha256', this.secret).update(rawBody, 'utf8').digest('hex');
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const providerReference = `mock_ch_${randomBytes(12).toString('hex')}`;
    const qs = new URLSearchParams({
      provider: this.name,
      reference: providerReference,
      clientId: input.clientId,
      amount: String(input.amountCents),
      currency: input.currency,
      kind: input.kind,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });
    for (const [k, v] of Object.entries(input.metadata ?? {})) {
      qs.set(`meta.${k}`, v);
    }
    qs.set('idempotencyKey', input.idempotencyKey);
    return {
      checkoutUrl: `https://mock.payments.local/checkout?${qs.toString()}`,
      providerReference,
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<NormalizedWebhookEvent> {
    const expected = this.signBody(input.rawBody);
    const provided = (input.signatureHeader ?? '').trim();
    if (provided.length !== expected.length) {
      throw new Error('Invalid webhook signature length');
    }
    const ok = timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
    if (!ok) {
      throw new Error('Invalid webhook signature');
    }
    const payload = JSON.parse(input.rawBody) as {
      eventId: string;
      eventType: 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED' | 'PAYMENT_REFUNDED' | 'CHECKOUT_COMPLETED';
      providerPaymentId: string;
      amountCents: number;
      currency: Currency;
      status: PaymentStatus;
      metadata?: Record<string, string>;
      receivedAt?: string;
    };
    return {
      providerEventId: payload.eventId,
      kind: payload.eventType,
      providerPaymentId: payload.providerPaymentId,
      amountCents: payload.amountCents,
      currency: payload.currency,
      status: payload.status,
      metadata: payload.metadata ?? {},
      receivedAt: payload.receivedAt ?? new Date().toISOString(),
    };
  }
}
