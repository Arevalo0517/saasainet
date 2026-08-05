import { createLogger } from '@platform/observability';
import { initRedisProvider } from '@platform/redis';
import { startMessageWorker } from './queues/message.worker.js';
import { startAiWorker } from './queues/ai.worker.js';
import { startWebhookWorker } from './queues/webhook.worker.js';
import { startPaymentWorker } from './queues/payment.worker.js';
import { startDocumentWorker } from './queues/document.worker.js';

const main = async () => {
  const logger = createLogger('worker');
  await initRedisProvider();
  logger.info('redis provider inicializado');

  await Promise.all([
    startMessageWorker(logger),
    startAiWorker(logger),
    startWebhookWorker(logger),
    startPaymentWorker(logger),
    startDocumentWorker(logger),
  ]);

  logger.info('workers iniciados. Esperando jobs...');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'cerrando workers');
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

main().catch((err) => {
  console.error('Error arrancando worker:', err);
  process.exit(1);
});
