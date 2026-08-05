import { z } from 'zod';
import { CommissionStatusSchema, CurrencySchema } from '../shared/enums.js';

export const CommissionEntrySchema = z.object({
  id: z.string().uuid(),
  distributorId: z.string().uuid(),
  clientId: z.string().uuid(),
  paymentId: z.string().uuid(),
  ruleId: z.string().uuid().nullable().optional(),
  eligibleAmountCents: z.number().int().nonnegative(),
  commissionRate: z.number().min(0).max(1),
  commissionAmountCents: z.number().int().nonnegative(),
  currency: CurrencySchema,
  status: CommissionStatusSchema,
  availableAt: z.string().datetime().nullable().optional(),
  paidAt: z.string().datetime().nullable().optional(),
  payoutId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type CommissionEntry = z.infer<typeof CommissionEntrySchema>;
