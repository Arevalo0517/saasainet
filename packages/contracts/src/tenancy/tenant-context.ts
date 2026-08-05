import { z } from 'zod';

export const TenantContextSchema = z.object({
  platformId: z.string().uuid(),
  distributorId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  isSupportSession: z.boolean().default(false),
  correlationId: z.string().optional(),
});
export type TenantContext = z.infer<typeof TenantContextSchema>;

export const TenantKindSchema = z.enum(['PLATFORM', 'DISTRIBUTOR', 'CLIENT']);
export type TenantKind = z.infer<typeof TenantKindSchema>;
