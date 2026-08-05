import { randomUUID } from 'node:crypto';

export const CORRELATION_HEADER = 'x-correlation-id';

export const newCorrelationId = (): string => randomUUID();

export const extractCorrelationId = (headers: Headers | Record<string, string | string[]>): string => {
  const raw =
    headers instanceof Headers
      ? headers.get(CORRELATION_HEADER)
      : (headers[CORRELATION_HEADER] as string | string[] | undefined);

  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') return raw[0];
  return newCorrelationId();
};
