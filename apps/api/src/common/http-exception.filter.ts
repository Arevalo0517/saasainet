import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CORRELATION_HEADER } from '@platform/observability';
import { ChannelError } from '../channels/channels.errors.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const correlationId = (req.headers[CORRELATION_HEADER] as string) ?? undefined;

    if (exception instanceof ChannelError) {
      res.status(exception.status).json({
        code: exception.code,
        message: exception.message,
        correlationId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = {
      code: this.toCode(status),
      message: this.toMessage(exception),
      correlationId,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error({ err: exception, correlationId, path: req.url }, 'error no controlado');
    }
    res.status(status).json(body);
  }

  private toCode(status: number): string {
    if (status === 400) return 'VALIDATION_ERROR';
    if (status === 401) return 'UNAUTHENTICATED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500) return 'INTERNAL_ERROR';
    return 'ERROR';
  }

  private toMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'string') return resp;
      if (typeof resp === 'object' && resp && 'message' in resp) {
        const m = (resp as { message: unknown }).message;
        if (typeof m === 'string') return m;
        if (Array.isArray(m)) return m.join(', ');
      }
      return exception.message;
    }
    if (exception instanceof Error) return exception.message;
    return 'Error interno';
  }
}
