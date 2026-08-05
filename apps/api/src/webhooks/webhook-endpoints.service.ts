import { randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { checkUrlAgainstAllowlist, type TenantContext } from '@platform/contracts';
import { decryptString, encryptString } from '@platform/encryption';
import type { WebhookDispatcherService } from './webhook-dispatcher.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  DrizzleWebhookEndpointsRepository,
  DrizzleWebhookEventsRepository,
  type WebhookEndpointRecord,
  type WebhookEventRecord,
  type WebhookDeliveryRecord,
} from '../infrastructure/persistence/drizzle/webhooks.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleClientsRepository } from '../infrastructure/persistence/drizzle/clients.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditService, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../audit/audit.service.js';
import { CLIENTS_REPO_TOKEN } from './webhooks.tokens.js';
import { WEBHOOK_NOT_FOUND, CROSS_TENANT_ENDPOINT } from './webhooks.errors.js';

const SUPPORTED_EVENTS = new Set([
  'agent.published',
  'conversation.started',
  'conversation.closed',
  'human.reply.created',
]);

export const isSupportedEvent = (t: string): boolean => SUPPORTED_EVENTS.has(t);

export const generateEndpointSecret = (): string => `whsec_${randomBytes(24).toString('hex')}`;

export const encryptWebhookSecret = (secret: string, endpointId: string): string =>
  encryptString(secret, `webhook_endpoint:${endpointId}`);

export const decryptWebhookSecret = (ciphertext: string, endpointId: string): string =>
  decryptString(ciphertext, `webhook_endpoint:${endpointId}`);

export const validateUrlAgainstAllowlist = (url: string, allowlist: readonly string[] = []): void => {
  const result = checkUrlAgainstAllowlist(url, allowlist);
  if (!result.ok) {
    throw new BadRequestException({ code: result.code, message: result.message });
  }
};

const validateEvents = (events: string[]): void => {
  for (const e of events) {
    if (!isSupportedEvent(e)) throw new Error(`evento no soportado: ${e}`);
  }
};

const assertSameTenant = (ctx: TenantContext, e: WebhookEndpointRecord): void => {
  if (ctx.platformId !== e.platformId) throw CROSS_TENANT_ENDPOINT();
  if (ctx.clientId !== e.clientId) throw CROSS_TENANT_ENDPOINT();
};

export interface CreateEndpointInput {
  name: string;
  url: string;
  events: string[];
  description?: string;
  allowlist?: readonly string[];
}

export interface UpdateEndpointInput {
  name?: string;
  url?: string;
  events?: string[];
  status?: 'ACTIVE' | 'PAUSED';
  description?: string;
  allowlist?: readonly string[];
}

export const toEndpointDto = (e: WebhookEndpointRecord): Record<string, unknown> => ({
  id: e.id,
  clientId: e.clientId,
  name: e.name,
  url: e.url,
  events: e.events,
  status: e.status,
  description: e.description,
  createdAt: e.createdAt.toISOString(),
  updatedAt: e.updatedAt.toISOString(),
  archivedAt: e.archivedAt?.toISOString() ?? null,
});

export interface EndpointWithSecret {
  dto: Record<string, unknown>;
  secret: string;
  allowlist: string[];
}

export const toEndpointWithSecretDto = (
  e: WebhookEndpointRecord,
  allowlist: readonly string[] = [],
): EndpointWithSecret => ({
  dto: toEndpointDto(e),
  secret: decryptWebhookSecret(e.secretCiphertext, e.id),
  allowlist: [...allowlist],
});

@Injectable()
export class WebhookEndpointsService {
  constructor(
    private readonly repo: DrizzleWebhookEndpointsRepository,
    private readonly events: DrizzleWebhookEventsRepository,
    @Inject(CLIENTS_REPO_TOKEN) private readonly clients: DrizzleClientsRepository,
    @Optional() private readonly audit: AuditService | null = null,
    @Optional() private readonly dispatcher: WebhookDispatcherService | null = null,
  ) {}

  private getClientAllowlist(clientId: string): Promise<readonly string[]> {
    return this.clients.getWebhookAllowedHosts(clientId);
  }

  async list(ctx: TenantContext, includeArchived: boolean): Promise<WebhookEndpointRecord[]> {
    return this.repo.listByClient(ctx.clientId as string, { includeArchived });
  }

  async get(ctx: TenantContext, id: string): Promise<WebhookEndpointRecord> {
    const ep = await this.repo.getById(ctx.clientId as string, id);
    if (ep === null) throw WEBHOOK_NOT_FOUND(id);
    return ep;
  }

  async getIncludingSecret(ctx: TenantContext, id: string): Promise<EndpointWithSecret> {
    const ep = await this.get(ctx, id);
    const allowlist = await this.getClientAllowlist(ctx.clientId as string);
    return toEndpointWithSecretDto(ep, allowlist);
  }

  async create(ctx: TenantContext, input: CreateEndpointInput): Promise<EndpointWithSecret> {
    const allowlist = input.allowlist ?? (await this.getClientAllowlist(ctx.clientId as string));
    validateUrlAgainstAllowlist(input.url, allowlist);
    validateEvents(input.events);
    const secret = generateEndpointSecret();
    const row = await this.repo.create({
      platformId: ctx.platformId,
      distributorId: ctx.distributorId as string,
      clientId: ctx.clientId as string,
      name: input.name,
      url: input.url,
      events: input.events,
      description: input.description ?? null,
      secretCiphertext: encryptWebhookSecret(secret, '__pending__'),
      status: 'ACTIVE',
      createdBy: ctx.userId,
    });
    const cipher = encryptWebhookSecret(secret, row.id);
    const updated = cipher === row.secretCiphertext
      ? row
      : await this.repo.rotateSecret(ctx.clientId as string, row.id, cipher);
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.WEBHOOK_ENDPOINT_CREATED,
      resourceType: AUDIT_RESOURCE_TYPES.WEBHOOK_ENDPOINT,
      resourceId: updated.id,
      metadata: { name: input.name, url: updated.url, events: input.events, allowlistMatched: allowlist },
    });
    return toEndpointWithSecretDto(updated, allowlist);
  }

  async update(ctx: TenantContext, id: string, patch: UpdateEndpointInput): Promise<WebhookEndpointRecord> {
    const ep = await this.get(ctx, id);
    assertSameTenant(ctx, ep);
    if (patch.url !== undefined) {
      const allowlist = patch.allowlist ?? (await this.getClientAllowlist(ctx.clientId as string));
      validateUrlAgainstAllowlist(patch.url, allowlist);
    }
    if (patch.events !== undefined) validateEvents(patch.events);
    const updated = await this.repo.update(ctx.clientId as string, id, {
      name: patch.name,
      url: patch.url,
      events: patch.events,
      status: patch.status,
      description: patch.description,
    });
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.WEBHOOK_ENDPOINT_UPDATED,
      resourceType: AUDIT_RESOURCE_TYPES.WEBHOOK_ENDPOINT,
      resourceId: id,
      metadata: { patch },
    });
    return updated;
  }

  async rotateSecret(ctx: TenantContext, id: string): Promise<EndpointWithSecret> {
    const ep = await this.get(ctx, id);
    assertSameTenant(ctx, ep);
    const secret = generateEndpointSecret();
    const updated = await this.repo.rotateSecret(ctx.clientId as string, id, encryptWebhookSecret(secret, id));
    const allowlist = await this.getClientAllowlist(ctx.clientId as string);
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.WEBHOOK_ENDPOINT_SECRET_ROTATED,
      resourceType: AUDIT_RESOURCE_TYPES.WEBHOOK_ENDPOINT,
      resourceId: id,
    });
    return toEndpointWithSecretDto(updated, allowlist);
  }

  async archive(ctx: TenantContext, id: string): Promise<WebhookEndpointRecord> {
    const ep = await this.get(ctx, id);
    assertSameTenant(ctx, ep);
    const updated = await this.repo.archive(ctx.clientId as string, id);
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.WEBHOOK_ENDPOINT_ARCHIVED,
      resourceType: AUDIT_RESOURCE_TYPES.WEBHOOK_ENDPOINT,
      resourceId: id,
    });
    return updated;
  }

  async test(ctx: TenantContext, id: string): Promise<WebhookEventRecord> {
    const ep = await this.get(ctx, id);
    assertSameTenant(ctx, ep);
    const key = `test-${id}-${Date.now()}`;
    const event = await this.events.create({
      platformId: ctx.platformId,
      distributorId: ctx.distributorId as string,
      clientId: ctx.clientId as string,
      type: 'conversation.started',
      idempotencyKey: key,
      payload: { test: true, sentAt: new Date().toISOString() },
    });
    if (this.dispatcher !== null) {
      await this.dispatcher.emit(
        { platformId: ctx.platformId, distributorId: ctx.distributorId as string, clientId: ctx.clientId as string },
        'conversation.started',
        { test: true, sentAt: new Date().toISOString() },
        `${key}-fanout`,
      );
    }
    return event;
  }
}

export type { WebhookEndpointRecord, WebhookEventRecord, WebhookDeliveryRecord };
