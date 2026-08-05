import type { Logger } from '@platform/observability';

export const startPaymentWorker = async (logger: Logger): Promise<void> => {
  logger.info('Fase 0: cola de pagos registrada (placeholder).');
};
