import type { Currency, PaymentStatus } from '@platform/contracts';

export interface CreateCheckoutInput {
  clientId: string;
  distributorId: string;
  kind: 'SUBSCRIPTION' | 'TOPUP';
  amountCents: number;
  currency: Currency;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}

export interface CreateCheckoutResult {
  checkoutUrl: string;
  providerReference: string;
}

export interface VerifyWebhookInput {
  rawBody: string;
  headers: Record<string, string>;
  signatureHeader: string;
}

export interface NormalizedWebhookEvent {
  providerEventId: string;
  kind: 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED' | 'PAYMENT_REFUNDED' | 'CHECKOUT_COMPLETED';
  providerPaymentId: string;
  amountCents: number;
  currency: Currency;
  status: PaymentStatus;
  metadata: Record<string, string>;
  receivedAt: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyWebhook(input: VerifyWebhookInput): Promise<NormalizedWebhookEvent>;
}

export { MockPaymentProvider } from './mock.js';
export const PLACEHOLDER = 'MockPaymentProvider disponible. Stripe pendiente para integración real.';
