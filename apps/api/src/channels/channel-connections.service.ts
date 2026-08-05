import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { TenantContext } from '@platform/contracts';
import { decryptJson, decryptString, encryptJson, encryptString } from '@platform/encryption';
import type {
  ChannelAdapter,
  ChannelAdapterRegistry,
  NormalizedMessage,
  RawProviderEvent,
} from '@platform/channel-adapters';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleChannelConnectionsRepository, type ChannelConnectionRecord } from '../infrastructure/persistence/drizzle/channels.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditService, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../audit/audit.service.js';
import { CHANNEL_ADAPTER_REGISTRY } from './channels.tokens.js';
import { CHANNEL_CONNECTION_NOT_FOUND, CROSS_TENANT_CHANNEL, INVALID_CHANNEL } from './channels.errors.js';

const SUPPORTED_CHANNELS = new Set(['WHATSAPP', 'TELEGRAM', 'MESSENGER', 'INSTAGRAM']);

export const generateWebhookSecret = (): string => `whsec_chan_${randomBytes(24).toString('hex')}`;

export const encryptChannelSecret = (secret: string, connectionId: string): string =>
  encryptString(secret, `channel_connection:${connectionId}`);

export const decryptChannelSecret = (ciphertext: string, connectionId: string): string =>
  decryptString(ciphertext, `channel_connection:${connectionId}`);

export const encryptChannelCredentials = (
  creds: Record<string, string>,
  connectionId: string,
): string => encryptJson(creds, `channel_connection:${connectionId}`);

export const decryptChannelCredentials = (
  ciphertext: string,
  connectionId: string,
): Record<string, string> => {
  if (ciphertext.length === 0) return {};
  return decryptJson<Record<string, string>>(ciphertext, `channel_connection:${connectionId}`);
};

export const verifyWebhookSignature = (
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean => {
  if (signatureHeader === undefined || signatureHeader === '') return false;
  const m = /sha256=([0-9a-f]{64})/i.exec(signatureHeader);
  if (m === null) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = m[1] ?? '';
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
};

const assertSameTenant = (ctx: TenantContext, c: ChannelConnectionRecord): void => {
  if (ctx.platformId !== c.platformId) throw CROSS_TENANT_CHANNEL();
  if (ctx.clientId !== c.clientId) throw CROSS_TENANT_CHANNEL();
};

const assertChannelSupported = (channel: string): void => {
  if (!SUPPORTED_CHANNELS.has(channel)) throw INVALID_CHANNEL(channel);
};

export interface ConnectionWithDecryptedSecrets {
  record: ChannelConnectionRecord;
  credentials: Record<string, string>;
  webhookSecret: string;
}

export const hydrateConnection = (c: ChannelConnectionRecord): ConnectionWithDecryptedSecrets => ({
  record: c,
  credentials: decryptChannelCredentials(c.credentialsCiphertext, c.id),
  webhookSecret: decryptChannelSecret(c.webhookSecretCiphertext, c.id),
});

export const toConnectionDto = (c: ChannelConnectionRecord): Record<string, unknown> => ({
  id: c.id,
  clientId: c.clientId,
  channel: c.channel,
  name: c.name,
  status: c.status,
  phoneNumber: c.phoneNumber,
  hasCredentials: c.credentialsCiphertext.length > 0,
  lastVerifiedAt: c.lastVerifiedAt?.toISOString() ?? null,
  lastError: c.lastError,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
  archivedAt: c.archivedAt?.toISOString() ?? null,
});

export interface ConnectionWithSecretDto {
  dto: Record<string, unknown>;
  webhookSecret: string;
}

export const toConnectionWithSecretDto = (c: ChannelConnectionRecord): ConnectionWithSecretDto => ({
  dto: toConnectionDto(c),
  webhookSecret: decryptChannelSecret(c.webhookSecretCiphertext, c.id),
});

export interface CreateConnectionInput {
  name: string;
  channel: string;
  phoneNumber?: string;
  credentials: Record<string, string>;
}

export interface UpdateConnectionInput {
  name?: string;
  phoneNumber?: string;
  credentials?: Record<string, string>;
}

@Injectable()
export class ChannelConnectionsService {
  constructor(
    private readonly repo: DrizzleChannelConnectionsRepository,
    @Inject(CHANNEL_ADAPTER_REGISTRY) private readonly registry: ChannelAdapterRegistry,
    @Optional() private readonly audit: AuditService | null = null,
  ) {}

  async list(ctx: TenantContext, includeArchived: boolean): Promise<ChannelConnectionRecord[]> {
    return this.repo.listByClient(ctx.clientId as string, includeArchived);
  }

  async get(ctx: TenantContext, id: string): Promise<ChannelConnectionRecord> {
    const c = await this.repo.getById(ctx.clientId as string, id);
    if (c === null) throw CHANNEL_CONNECTION_NOT_FOUND(id);
    return c;
  }

  async create(ctx: TenantContext, input: CreateConnectionInput): Promise<ConnectionWithSecretDto> {
    assertChannelSupported(input.channel);
    const webhookSecret = generateWebhookSecret();
    const row = await this.repo.create({
      platformId: ctx.platformId,
      distributorId: ctx.distributorId as string,
      clientId: ctx.clientId as string,
      channel: input.channel,
      name: input.name,
      phoneNumber: input.phoneNumber ?? null,
      credentialsCiphertext: encryptChannelCredentials(input.credentials, '__pending__'),
      status: 'PENDING',
      webhookSecretCiphertext: encryptChannelSecret(webhookSecret, '__pending__'),
      createdBy: ctx.userId,
    });
    const reEncrypted = await this.repo.update(ctx.clientId as string, row.id, {
      credentialsCiphertext: encryptChannelCredentials(input.credentials, row.id),
      webhookSecretCiphertext: encryptChannelSecret(webhookSecret, row.id),
    });
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.CHANNEL_CONNECTION_CREATED,
      resourceType: AUDIT_RESOURCE_TYPES.CHANNEL_CONNECTION,
      resourceId: reEncrypted.id,
      metadata: { channel: reEncrypted.channel, name: reEncrypted.name, hasPhone: reEncrypted.phoneNumber !== null },
    });
    return toConnectionWithSecretDto(reEncrypted);
  }

  async update(ctx: TenantContext, id: string, patch: UpdateConnectionInput): Promise<ChannelConnectionRecord> {
    const c = await this.get(ctx, id);
    assertSameTenant(ctx, c);
    const patchWithCipher: Partial<
      Pick<ChannelConnectionRecord, 'name' | 'phoneNumber' | 'credentialsCiphertext'>
    > = {
      name: patch.name,
      phoneNumber: patch.phoneNumber,
    };
    if (patch.credentials !== undefined) {
      patchWithCipher.credentialsCiphertext = encryptChannelCredentials(patch.credentials, c.id);
    }
    const updated = await this.repo.update(ctx.clientId as string, id, patchWithCipher);
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.CHANNEL_CONNECTION_UPDATED,
      resourceType: AUDIT_RESOURCE_TYPES.CHANNEL_CONNECTION,
      resourceId: id,
      metadata: { nameChanged: patch.name !== undefined, phoneChanged: patch.phoneNumber !== undefined, credentialsChanged: patch.credentials !== undefined },
    });
    return updated;
  }

  async archive(ctx: TenantContext, id: string): Promise<ChannelConnectionRecord> {
    const c = await this.get(ctx, id);
    assertSameTenant(ctx, c);
    const updated = await this.repo.archive(ctx.clientId as string, id);
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.CHANNEL_CONNECTION_ARCHIVED,
      resourceType: AUDIT_RESOURCE_TYPES.CHANNEL_CONNECTION,
      resourceId: id,
    });
    return updated;
  }

  async verify(ctx: TenantContext, id: string): Promise<ChannelConnectionRecord> {
    const c = await this.get(ctx, id);
    assertSameTenant(ctx, c);
    const adapter: ChannelAdapter = this.registry.get(c.channel as 'WHATSAPP' | 'TELEGRAM' | 'MESSENGER' | 'INSTAGRAM');
    const credentials = decryptChannelCredentials(c.credentialsCiphertext, c.id);
    const status = await adapter.verifyConnection({ channelConnectionId: c.id, credentials });
    const updated = await this.repo.update(ctx.clientId as string, id, {
      status: status.state,
      lastError: status.message ?? null,
      lastVerifiedAt: new Date(),
    });
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.CHANNEL_CONNECTION_VERIFIED,
      resourceType: AUDIT_RESOURCE_TYPES.CHANNEL_CONNECTION,
      resourceId: id,
      metadata: { state: status.state, error: status.message ?? null },
    });
    return updated;
  }

  async rotateWebhookSecret(ctx: TenantContext, id: string): Promise<ConnectionWithSecretDto> {
    const c = await this.get(ctx, id);
    assertSameTenant(ctx, c);
    const webhookSecret = generateWebhookSecret();
    const updated = await this.repo.update(ctx.clientId as string, id, {
      webhookSecretCiphertext: encryptChannelSecret(webhookSecret, c.id),
    });
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.CHANNEL_CONNECTION_SECRET_ROTATED,
      resourceType: AUDIT_RESOURCE_TYPES.CHANNEL_CONNECTION,
      resourceId: id,
    });
    return toConnectionWithSecretDto(updated);
  }

  async getByIdAny(id: string): Promise<ChannelConnectionRecord | null> {
    return this.repo.getByIdAny(id);
  }

  async getDecryptedByIdAny(id: string): Promise<ConnectionWithDecryptedSecrets | null> {
    const c = await this.repo.getByIdAny(id);
    if (c === null) return null;
    return hydrateConnection(c);
  }

  async parseInboundEvent(connection: ChannelConnectionRecord, payload: unknown, providerEventId: string, rawPayloadReference: string): Promise<NormalizedMessage[]> {
    const adapter = this.registry.get(connection.channel as 'WHATSAPP' | 'TELEGRAM' | 'MESSENGER' | 'INSTAGRAM');
    const event: RawProviderEvent = {
      channel: connection.channel as 'WHATSAPP' | 'TELEGRAM' | 'MESSENGER' | 'INSTAGRAM',
      channelConnectionId: connection.id,
      providerEventId,
      payload,
      rawPayloadReference,
    };
    return adapter.parseInboundEvent(event);
  }
}
