import { z } from 'zod';
import { CurrencySchema, PaymentStatusSchema } from '../shared/enums.js';

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  distributorId: z.string().uuid(),
  paymentCustomerId: z.string().uuid(),
  providerPaymentId: z.string(),
  provider: z.string(),
  amountCents: z.number().int().nonnegative(),
  currency: CurrencySchema,
  status: PaymentStatusSchema,
  kind: z.enum(['SUBSCRIPTION', 'TOPUP']),
  description: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  paidAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type Payment = z.infer<typeof PaymentSchema>;
