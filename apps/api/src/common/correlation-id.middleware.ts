import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CORRELATION_HEADER, newCorrelationId } from '@platform/observability';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[CORRELATION_HEADER];
    const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : newCorrelationId();
    req.headers[CORRELATION_HEADER] = id;
    res.setHeader(CORRELATION_HEADER, id);
    next();
  }
}
