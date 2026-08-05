import { z } from 'zod';
import { AgentStateSchema, LocaleSchema } from '../shared/enums.js';

export const AgentVersionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  version: z.number().int().positive(),
  state: AgentStateSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  language: LocaleSchema,
  timezone: z.string().default('UTC'),
  objective: z.string().max(2000).nullable().optional(),
  personality: z.string().max(2000).nullable().optional(),
  tone: z.string().max(500).nullable().optional(),
  systemPrompt: z.string().max(20000),
  welcomeMessage: z.string().max(1000).nullable().optional(),
  outOfHoursMessage: z.string().max(1000).nullable().optional(),
  allowedRules: z.array(z.string()).default([]),
  forbiddenRules: z.array(z.string()).default([]),
  dataToRequest: z.array(z.string()).default([]),
  sensitiveDataForbidden: z.array(z.string()).default([]),
  modelProfile: z.string().min(1),
  modelParameters: z.record(z.string(), z.unknown()).default({}),
  publishedAt: z.string().datetime().nullable().optional(),
  publishedBy: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AgentVersion = z.infer<typeof AgentVersionSchema>;

export const AgentTurnInputSchema = z.object({
  conversationId: z.string().uuid(),
  agentVersionId: z.string().uuid(),
  inboundMessageId: z.string().uuid(),
  correlationId: z.string().optional(),
});
export type AgentTurnInput = z.infer<typeof AgentTurnInputSchema>;

export const AgentTurnResultSchema = z.object({
  agentRunId: z.string().uuid(),
  conversationId: z.string().uuid(),
  outputMessageId: z.string().uuid().nullable(),
  state: z.enum(['PENDING', 'COMPLETED', 'ERROR', 'HANDED_OFF']),
  handoffRequested: z.boolean().default(false),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      estimatedCostUsd: z.number().nonnegative(),
      latencyMs: z.number().int().nonnegative(),
    })
    .optional(),
  error: z.string().optional(),
});
export type AgentTurnResult = z.infer<typeof AgentTurnResultSchema>;
