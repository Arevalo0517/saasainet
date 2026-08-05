import { Inject, Injectable, Optional } from '@nestjs/common';
import { createLogger } from '@platform/observability';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleUsageEventsRepository } from '../infrastructure/persistence/drizzle/usage.repository.js';
import { USAGE_REPO_TOKEN } from './usage.tokens.js';

const log = createLogger('usage');

export const USAGE_METRICS = {
  MESSAGES_SENT: 'messages_sent',
  MESSAGES_RECEIVED: 'messages_received',
  TOKENS_INPUT: 'tokens_input',
  TOKENS_OUTPUT: 'tokens_output',
  AGENT_RUNS: 'agent_runs',
} as const;

export type UsageMetric = (typeof USAGE_METRICS)[keyof typeof USAGE_METRICS];

export interface EmitInput {
  readonly platformId: string;
  readonly distributorId: string;
  readonly clientId: string;
  readonly metric: UsageMetric | string;
  readonly quantity: number;
  readonly costCents?: number;
  readonly modelProfile?: string | null;
  readonly agentId?: string | null;
  readonly conversationId?: string | null;
  readonly occurredAt?: Date;
}

export interface AggregateInput {
  readonly platformId: string;
  readonly distributorId?: string | null;
  readonly clientId?: string | null;
  readonly metric?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly groupBy?: 'agent' | 'channel' | 'client' | 'distributor' | 'day' | 'metric';
}

export interface UsageAggregateOutput {
  readonly rows: Array<{ key: string; totalQuantity: number; totalCostCents: number; eventCount: number }>;
  readonly totals: { key: string; totalQuantity: number; totalCostCents: number; eventCount: number };
}

@Injectable()
export class UsageEventsService {
  constructor(
    @Optional() @Inject(USAGE_REPO_TOKEN) private readonly repo: DrizzleUsageEventsRepository | null = null,
  ) {}

  emit(input: EmitInput): void {
    if (this.repo === null) {
      log.warn({ metric: input.metric, clientId: input.clientId }, 'usage emit skipped: repo no inyectado');
      return;
    }
    if (input.quantity <= 0) return;
    void this.repo
      .record({
        platformId: input.platformId,
        distributorId: input.distributorId,
        clientId: input.clientId,
        metric: input.metric,
        quantity: input.quantity,
        costCents: input.costCents ?? 0,
        modelProfile: input.modelProfile ?? null,
        agentId: input.agentId ?? null,
        conversationId: input.conversationId ?? null,
        occurredAt: input.occurredAt,
      })
      .catch((err) => {
        log.error({ err, metric: input.metric, clientId: input.clientId }, 'usage record failed');
      });
  }

  async aggregate(input: AggregateInput): Promise<UsageAggregateOutput> {
    if (this.repo === null) {
      return { rows: [], totals: { key: '__all__', totalQuantity: 0, totalCostCents: 0, eventCount: 0 } };
    }
    const filter: { metric?: string; from?: Date; to?: Date; groupBy?: 'agent' | 'channel' | 'client' | 'distributor' | 'day' | 'metric'; clientId?: string; distributorId?: string } = {
      ...(input.metric !== undefined ? { metric: input.metric } : {}),
      ...(input.from !== undefined ? { from: input.from } : {}),
      ...(input.to !== undefined ? { to: input.to } : {}),
      ...(input.groupBy !== undefined ? { groupBy: input.groupBy } : {}),
    };
    if (input.clientId !== null && input.clientId !== undefined) {
      filter.clientId = input.clientId;
    } else if (input.distributorId !== null && input.distributorId !== undefined) {
      filter.distributorId = input.distributorId;
    }
    return this.repo.aggregate(filter);
  }
}
