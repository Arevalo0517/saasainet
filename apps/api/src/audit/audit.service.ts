import { Inject, Injectable, Optional } from '@nestjs/common';
import type { TenantContext } from '@platform/contracts';
import { createLogger } from '@platform/observability';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleAuditEventsRepository } from '../infrastructure/persistence/drizzle/audit.repository.js';
import { AUDIT_REPO_TOKEN } from './audit.tokens.js';

const log = createLogger('audit');

export const AUDIT_ACTIONS = {
  WEBHOOK_ENDPOINT_CREATED: 'webhook_endpoint.created',
  WEBHOOK_ENDPOINT_UPDATED: 'webhook_endpoint.updated',
  WEBHOOK_ENDPOINT_SECRET_ROTATED: 'webhook_endpoint.secret_rotated',
  WEBHOOK_ENDPOINT_ARCHIVED: 'webhook_endpoint.archived',
  CHANNEL_CONNECTION_CREATED: 'channel_connection.created',
  CHANNEL_CONNECTION_UPDATED: 'channel_connection.updated',
  CHANNEL_CONNECTION_VERIFIED: 'channel_connection.verified',
  CHANNEL_CONNECTION_SECRET_ROTATED: 'channel_connection.secret_rotated',
  CHANNEL_CONNECTION_ARCHIVED: 'channel_connection.archived',
  CLIENT_CREATED: 'client.created',
  CLIENT_UPDATED: 'client.updated',
  CLIENT_ARCHIVED: 'client.archived',
  CLIENT_WEBHOOK_ALLOWLIST_UPDATED: 'client.webhook_allowlist_updated',
  DISTRIBUTOR_CREATED: 'distributor.created',
  DISTRIBUTOR_UPDATED: 'distributor.updated',
  AGENT_VERSION_PUBLISHED: 'agent_version.published',
  AGENT_VERSION_ARCHIVED: 'agent_version.archived',
  AGENT_ARCHIVED: 'agent.archived',
  USER_ROLE_GRANTED: 'user_role.granted',
  USER_ROLE_REVOKED: 'user_role.revoked',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_RESOURCE_TYPES = {
  WEBHOOK_ENDPOINT: 'webhook_endpoint',
  CHANNEL_CONNECTION: 'channel_connection',
  CLIENT: 'client',
  DISTRIBUTOR: 'distributor',
  AGENT_VERSION: 'agent_version',
  AGENT: 'agent',
  USER_ROLE: 'user_role',
} as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[keyof typeof AUDIT_RESOURCE_TYPES];

export interface RecordInput {
  readonly ctx: Pick<TenantContext, 'platformId' | 'distributorId' | 'clientId' | 'userId' | 'roles' | 'isSupportSession'>;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly metadata?: Record<string, unknown>;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

export interface QueryInput {
  readonly ctx: Pick<TenantContext, 'platformId' | 'distributorId' | 'clientId' | 'roles' | 'isSupportSession'>;
  readonly action?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly actorUserId?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
  readonly offset?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @Optional() @Inject(AUDIT_REPO_TOKEN) private readonly repo: DrizzleAuditEventsRepository | null = null,
  ) {}

  record(input: RecordInput): void {
    if (this.repo === null) {
      log.warn({ action: input.action, resourceType: input.resourceType, resourceId: input.resourceId }, 'audit skipped: repo no inyectado');
      return;
    }
    const clientId = input.ctx.clientId;
    const distributorId = input.ctx.distributorId;
    if (clientId === null || clientId === undefined) {
      log.warn({ action: input.action, resourceType: input.resourceType, resourceId: input.resourceId }, 'audit skipped: clientId null');
      return;
    }
    if (distributorId === null || distributorId === undefined) {
      log.warn({ action: input.action }, 'audit skipped: distributorId null');
      return;
    }
    const actorRole = input.ctx.roles[0] ?? null;
    void this.repo
      .record({
        platformId: input.ctx.platformId,
        distributorId,
        clientId,
        actorUserId: input.ctx.userId,
        actorRole,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })
      .catch((err) => {
        log.error({ err, action: input.action, resourceId: input.resourceId }, 'audit record failed');
      });
  }

  async query(input: QueryInput): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    if (this.repo === null) {
      return { items: [], total: 0 };
    }
    const isPlatformAdmin = input.ctx.roles.includes('platform_super_admin') || input.ctx.isSupportSession === true;
    const filters = {
      ...(input.action !== undefined ? { action: input.action } : {}),
      ...(input.resourceType !== undefined ? { resourceType: input.resourceType } : {}),
      ...(input.resourceId !== undefined ? { resourceId: input.resourceId } : {}),
      ...(input.actorUserId !== undefined ? { actorUserId: input.actorUserId } : {}),
      ...(input.from !== undefined ? { from: input.from } : {}),
      ...(input.to !== undefined ? { to: input.to } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.offset !== undefined ? { offset: input.offset } : {}),
    };
    if (!isPlatformAdmin) {
      if (input.ctx.clientId === null || input.ctx.clientId === undefined) {
        return { items: [], total: 0 };
      }
      (filters as { clientId: string }).clientId = input.ctx.clientId;
    }
    const result = await this.repo.query(filters);
    return {
      total: result.total,
      items: result.items.map((row) => ({
        id: row.id,
        platformId: row.platformId,
        distributorId: row.distributorId,
        clientId: row.clientId,
        actorUserId: row.actorUserId,
        actorRole: row.actorRole,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        metadata: row.metadata,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}
