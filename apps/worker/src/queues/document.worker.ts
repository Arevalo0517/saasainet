import type { Logger } from '@platform/observability';

export const startDocumentWorker = async (logger: Logger): Promise<void> => {
  logger.info('Fase 0: cola de documentos registrada (placeholder).');
};
