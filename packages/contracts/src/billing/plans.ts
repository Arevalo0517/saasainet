import { z } from 'zod';
import { CurrencySchema } from '../shared/enums.js';

export const PlanVersionSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  version: z.number().int().positive(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  currency: CurrencySchema,
  monthlyPriceCents: z.number().int().nonnegative(),
  includedMessageCredits: z.number().int().nonnegative(),
  rolloverEnabled: z.boolean().default(false),
  gracePolicyEnabled: z.boolean().default(false),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
});
export type PlanVersion = z.infer<typeof PlanVersionSchema>;

export const TopUpProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  currency: CurrencySchema,
  priceCents: z.number().int().nonnegative(),
  creditsGranted: z.number().int().positive(),
  expirationDays: z.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
});
export type TopUpProduct = z.infer<typeof TopUpProductSchema>;
