import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { raw, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware.js';
import { createLogger } from '@platform/observability';
import { initRedisProvider } from '@platform/redis';

const bootstrap = async () => {
  const logger = createLogger('api');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useLogger(false);

  app.use(helmet());
  app.use(new CorrelationIdMiddleware().use);
  app.use('/api/v1/webhooks', (req: Request, _res: Response, next: NextFunction) => {
    raw({ type: '*/*', limit: '1mb' })(req, _res, () => {
      if (Buffer.isBuffer(req.body)) {
        (req as Request & { rawBody: string }).rawBody = req.body.toString('utf8');
      }
      next();
    });
  });
  app.use('/api/v1/channels', (req: Request, _res: Response, next: NextFunction) => {
    raw({ type: '*/*', limit: '1mb' })(req, _res, () => {
      if (Buffer.isBuffer(req.body)) {
        (req as Request & { rawBody: string }).rawBody = req.body.toString('utf8');
      }
      next();
    });
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swagger = new DocumentBuilder()
    .setTitle('Plataforma SaaS Chatbots AI')
    .setDescription('API REST multi-tenant B2B2B')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api/v1/docs', app, document);

  app.enableCors({
    origin: process.env.APP_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  await initRedisProvider().catch((err) => {
    logger.warn({ err }, 'redis provider no inicializado en arranque, seguirá inMemory');
  });

  if (process.env.URL_SAFETY_CUSTOM_DNS !== '1') {
    try {
      const { promises: dnsPromises } = await import('node:dns');
      dnsPromises.setServers(['1.1.1.1', '8.8.8.8']);
      logger.info('url-safety: DNS servers fijados a 1.1.1.1, 8.8.8.8 (evita DNS poisoning local)');
    } catch (err) {
      logger.warn({ err }, 'url-safety: no se pudieron fijar DNS servers');
    }
  }

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  logger.info({ port }, 'API escuchando');
};
void bootstrap();
