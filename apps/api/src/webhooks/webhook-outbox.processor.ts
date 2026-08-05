import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { WEBHOOK_REPO_TOKENS, type DrizzleWebhookDeliveriesRepository } from '../infrastructure/persistence/drizzle/webhooks.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WebhookDispatcherService } from './webhook-dispatcher.service.js';

export const OUTBOX_INTERVAL_MS = Symbol.for('platform.api.webhooks.outboxIntervalMs');
export const OUTBOX_BATCH = Symbol.for('platform.api.webhooks.outboxBatch');
export const DISPATCHER_HTTP = Symbol.for('platform.api.webhooks.httpClient');

const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_BATCH = 25;

@Injectable()
export class WebhookOutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookOutboxProcessor.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly dispatcher: WebhookDispatcherService,
    @Inject(WEBHOOK_REPO_TOKENS.DELIVERIES)
    private readonly _deliveries: DrizzleWebhookDeliveriesRepository,
  ) {}

  onModuleInit(): void {
    const intervalMs = Number(process.env.WEBHOOK_OUTBOX_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
    if (intervalMs <= 0) {
      this.logger.warn('outbox desactivado (WEBHOOK_OUTBOX_INTERVAL_MS<=0)');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.timer.unref?.();
    this.logger.log(`outbox scheduler activo: cada ${intervalMs}ms, batch=${DEFAULT_BATCH}`);
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.dispatcher.processDue(DEFAULT_BATCH);
    } catch (err) {
      this.logger.error('outbox tick falló', err as Error);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
