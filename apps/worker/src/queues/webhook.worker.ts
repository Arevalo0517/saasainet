import type { Logger } from '@platform/observability';

export const startWebhookWorker = async (logger: Logger): Promise<void> => {
  logger.info('Fase 0: cola de webhooks registrada (placeholder).');
};
