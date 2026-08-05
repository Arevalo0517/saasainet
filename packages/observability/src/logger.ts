import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';

const baseOptions: LoggerOptions = {
  level,
  base: {
    service: process.env.SERVICE_NAME,
    env: process.env.NODE_ENV ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'access_token',
      'refresh_token',
      'authorization',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
      '*.api_key',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
};

const isDev = process.env.NODE_ENV !== 'production';

export const createLogger = (name: string): PinoLogger => {
  if (isDev) {
    return pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
      },
    }).child({ name });
  }
  return pino(baseOptions).child({ name });
};

export type Logger = PinoLogger;
