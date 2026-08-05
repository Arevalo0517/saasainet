import type { Logger } from '@platform/observability';

export const startMessageWorker = async (logger: Logger): Promise<void> => {
  logger.info('Fase 0: cola de mensajes registrada (placeholder).');
};
