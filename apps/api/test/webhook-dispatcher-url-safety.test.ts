import { describe, it, expect, beforeAll } from 'vitest';
import { WebhookDispatcherService, defaultUrlSafetyChecker, type UrlSafetyChecker } from '../src/webhooks/webhook-dispatcher.service.js';
import type { HttpDeliveryClient, HttpDeliveryRequest, HttpDeliveryResponse } from '@platform/webhook-sdk';
import { resolveAndCheck } from '@platform/url-safety';
import { encryptString, setEncryptionKeyForTests } from '@platform/encryption';
import type {
  DrizzleWebhookEndpointsRepository,
  DrizzleWebhookEventsRepository,
  DrizzleWebhookDeliveriesRepository,
  WebhookDeliveryRecord,
  WebhookEndpointRecord,
} from '../src/infrastructure/persistence/drizzle/webhooks.repository.js';

class MockHttpClient implements HttpDeliveryClient {
  public sent: HttpDeliveryRequest[] = [];
  async post(req: HttpDeliveryRequest): Promise<HttpDeliveryResponse> {
    this.sent.push(req);
    return { statusCode: 200, body: 'ok' };
  }
}

interface MarkRetryCall {
  status: string;
  httpStatus: number | null;
  errorMessage: string | null;
  attempt: number;
}

const noopEvents = {} as DrizzleWebhookEventsRepository;

const buildDispatcher = (opts: {
  endpoint: WebhookEndpointRecord | null;
  http?: HttpDeliveryClient;
  allowlist?: readonly string[];
  urlSafety?: UrlSafetyChecker;
}): {
  service: WebhookDispatcherService;
  http: MockHttpClient;
  markRetryCalls: MarkRetryCall[];
  markInFlightCalls: number;
  markSucceededCalls: number;
} => {
  const markRetryCalls: MarkRetryCall[] = [];
  const markSucceededCalls: number[] = [];
  let markInFlightCalls = 0;
  const http = opts.http ?? new MockHttpClient();
  const deliveries = {
    markInFlight: async (_id: string): Promise<void> => {
      markInFlightCalls += 1;
    },
    markRetry: async (
      _id: string,
      status: string,
      httpStatus: number | null,
      errorMessage: string | null,
      _body: string | null,
      _nextRetryAt: Date | null,
      attempt: number,
    ): Promise<WebhookDeliveryRecord> => {
      markRetryCalls.push({ status, httpStatus, errorMessage, attempt });
      return {} as WebhookDeliveryRecord;
    },
    markSucceeded: async (_id: string, httpStatus: number, _body: string): Promise<WebhookDeliveryRecord> => {
      markSucceededCalls.push(httpStatus);
      return {} as WebhookDeliveryRecord;
    },
  } as unknown as DrizzleWebhookDeliveriesRepository;
  const endpoints = {
    getByIdAny: async (_id: string): Promise<WebhookEndpointRecord | null> => opts.endpoint,
  } as unknown as DrizzleWebhookEndpointsRepository;
  const service = new WebhookDispatcherService({
    endpoints,
    events: noopEvents,
    deliveries,
    http,
    urlSafety: opts.urlSafety ?? defaultUrlSafetyChecker,
    getClientAllowlist: async () => opts.allowlist ?? [],
  });
  return { service, http, markRetryCalls, markInFlightCalls, markSucceededCalls };
};

const buildEndpoint = (overrides: Partial<WebhookEndpointRecord> = {}): WebhookEndpointRecord => {
  const id = 'a0000001-0000-4000-8000-000000000001';
  const secretCiphertext = encryptString('whsec_test_secret', `webhook_endpoint:${id}`);
  return {
    id,
    platformId: 'p1',
    distributorId: 'd1',
    clientId: 'c1',
    name: 'test',
    url: 'https://hooks.example.com/wh',
    events: ['conversation.started'],
    description: null,
    secretCiphertext,
    status: 'ACTIVE',
    archivedAt: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

const buildDelivery = (): WebhookDeliveryRecord => ({
  id: 'b0000001-0000-4000-8000-000000000001',
  platformId: 'p1',
  distributorId: 'd1',
  clientId: 'c1',
  endpointId: 'a0000001-0000-4000-8000-000000000001',
  eventId: 'e1',
  requestBody: '{"hello":"world"}',
  status: 'PENDING',
  attemptCount: '0',
  responseStatus: null,
  responseBody: null,
  errorMessage: null,
  nextRetryAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('WebhookDispatcher integration with @platform/url-safety (Fase 8c)', () => {
  beforeAll(() => {
    setEncryptionKeyForTests(Buffer.alloc(32, 7));
  });

  it('defaultUrlSafetyChecker: blocks localhost literal', async () => {
    const ep = buildEndpoint({ url: 'http://localhost:3000/wh' });
    const { service, http, markRetryCalls } = buildDispatcher({ endpoint: ep });
    await service.attemptDelivery(buildDelivery());
    expect(http.sent.length).toBe(0);
    expect(markRetryCalls.length).toBe(1);
    expect(markRetryCalls[0]?.status).toBe('DLQ');
    expect(markRetryCalls[0]?.errorMessage ?? '').toMatch(/URL_HOST_BLOCKED|bloqueada por política/);
  });

  it('defaultUrlSafetyChecker: blocks metadata.google.internal even with empty allowlist', async () => {
    const ep = buildEndpoint({ url: 'http://metadata.google.internal/' });
    const { service, http, markRetryCalls } = buildDispatcher({ endpoint: ep });
    await service.attemptDelivery(buildDelivery());
    expect(http.sent.length).toBe(0);
    expect(markRetryCalls[0]?.status).toBe('DLQ');
  });

  it('defaultUrlSafetyChecker: blocks when allowlist does not match', async () => {
    const ep = buildEndpoint({ url: 'https://evil.com/wh' });
    const { service, http, markRetryCalls } = buildDispatcher({
      endpoint: ep,
      allowlist: ['hooks.example.com'],
    });
    await service.attemptDelivery(buildDelivery());
    expect(http.sent.length).toBe(0);
    expect(markRetryCalls[0]?.errorMessage ?? '').toMatch(/URL_NOT_IN_ALLOWLIST/);
  });

  it('defaultUrlSafetyChecker: blocks private IP resolution (mocked resolver)', async () => {
    const ep = buildEndpoint({ url: 'https://hooks.example.com/wh' });
    const checker: UrlSafetyChecker = async (url, options) => {
      return resolveAndCheck(url, {
        ...options,
        resolver: async () => ['10.0.0.5'],
      });
    };
    const { service, http, markRetryCalls } = buildDispatcher({ endpoint: ep, urlSafety: checker });
    await service.attemptDelivery(buildDelivery());
    expect(http.sent.length).toBe(0);
    expect(markRetryCalls[0]?.errorMessage ?? '').toMatch(/URL_PRIVATE_IP/);
  });

  it('defaultUrlSafetyChecker: blocks cloud metadata IP 169.254.169.254 (mocked)', async () => {
    const ep = buildEndpoint({ url: 'https://hooks.example.com/wh' });
    const checker: UrlSafetyChecker = async (url, options) => {
      return resolveAndCheck(url, {
        ...options,
        resolver: async () => ['169.254.169.254'],
      });
    };
    const { service, http, markRetryCalls } = buildDispatcher({ endpoint: ep, urlSafety: checker });
    await service.attemptDelivery(buildDelivery());
    expect(http.sent.length).toBe(0);
    expect(markRetryCalls[0]?.errorMessage ?? '').toMatch(/URL_PRIVATE_IP/);
  });

  it('defaultUrlSafetyChecker: allows when public IP resolves (mocked)', async () => {
    const ep = buildEndpoint({ url: 'https://hooks.example.com/wh' });
    const checker: UrlSafetyChecker = async (url, options) => {
      return resolveAndCheck(url, {
        ...options,
        resolver: async () => ['1.1.1.1'],
      });
    };
    const { service, http, markSucceededCalls } = buildDispatcher({ endpoint: ep, urlSafety: checker });
    await service.attemptDelivery(buildDelivery());
    expect(http.sent.length).toBe(1);
    expect(markSucceededCalls).toEqual([200]);
  });

  it('defaultUrlSafetyChecker: blocks multi-A record attack (any private IP)', async () => {
    const ep = buildEndpoint({ url: 'https://hooks.example.com/wh' });
    const checker: UrlSafetyChecker = async (url, options) => {
      return resolveAndCheck(url, {
        ...options,
        resolver: async () => ['1.1.1.1', '10.0.0.5'],
      });
    };
    const { service, http, markRetryCalls } = buildDispatcher({ endpoint: ep, urlSafety: checker });
    await service.attemptDelivery(buildDelivery());
    expect(http.sent.length).toBe(0);
    expect(markRetryCalls[0]?.errorMessage ?? '').toMatch(/URL_PRIVATE_IP/);
  });

  it('defaultUrlSafetyChecker: blocks when DNS resolution fails', async () => {
    const ep = buildEndpoint({ url: 'https://hooks.example.com/wh' });
    const checker: UrlSafetyChecker = async (url, options) => {
      return resolveAndCheck(url, {
        ...options,
        resolver: async () => {
          throw new Error('ENOTFOUND');
        },
      });
    };
    const { service, http, markRetryCalls } = buildDispatcher({ endpoint: ep, urlSafety: checker });
    await service.attemptDelivery(buildDelivery());
    expect(http.sent.length).toBe(0);
    expect(markRetryCalls[0]?.errorMessage ?? '').toMatch(/DNS_LOOKUP_FAILED/);
  });

  it('respects allowlist wildcard when DNS resolves to public IP', async () => {
    const ep = buildEndpoint({ url: 'https://a.b.example.com/wh' });
    const checker: UrlSafetyChecker = async (url, options) => {
      return resolveAndCheck(url, {
        ...options,
        resolver: async () => ['8.8.8.8'],
      });
    };
    const { service, http, markSucceededCalls } = buildDispatcher({
      endpoint: ep,
      urlSafety: checker,
      allowlist: ['*.example.com'],
    });
    await service.attemptDelivery(buildDelivery());
    expect(http.sent.length).toBe(1);
    expect(markSucceededCalls).toEqual([200]);
  });
});
