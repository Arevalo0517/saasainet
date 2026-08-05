import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { TenantContext } from '@platform/contracts';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleAgentRepository, type AgentRecord, type AgentVersionRecord } from '../infrastructure/persistence/drizzle/agents.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WebhookDispatcherService } from '../webhooks/webhook-dispatcher.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditService, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../audit/audit.service.js';

export const AGENT_NOT_FOUND = 'AGENT_NOT_FOUND';
export const AGENT_VERSION_NOT_FOUND = 'AGENT_VERSION_NOT_FOUND';
export const AGENT_DUPLICATE_KEY = 'AGENT_DUPLICATE_KEY';
export const CROSS_TENANT_AGENT = 'CROSS_TENANT_AGENT';

@Injectable()
export class AgentsService {
  constructor(
    private readonly repo: DrizzleAgentRepository,
    @Optional() private readonly webhooks?: WebhookDispatcherService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async list(ctx: TenantContext, includeArchived: boolean): Promise<AgentRecord[]> {
    this.assertClientAccess(ctx);
    return this.repo.listByClient(ctx.clientId as string, includeArchived);
  }

  async create(
    ctx: TenantContext,
    input: Omit<AgentRecord, 'id' | 'platformId' | 'distributorId' | 'clientId' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'publicWidgetId'>,
  ): Promise<AgentRecord> {
    this.assertClientAccess(ctx);
    const existing = await this.repo.findByClientAndKey(ctx.clientId as string, input.key);
    if (existing !== null) {
      throw new ForbiddenException({ code: AGENT_DUPLICATE_KEY, message: 'Ya existe un agent con esa key en este client' });
    }
    return this.repo.create({
      ...input,
      publicWidgetId: `wgt_${this.generateWidgetId()}`,
      platformId: ctx.platformId,
      distributorId: ctx.distributorId as string,
      clientId: ctx.clientId as string,
    });
  }

  private generateWidgetId(): string {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }

  async getById(ctx: TenantContext, id: string): Promise<AgentRecord> {
    this.assertClientAccess(ctx);
    const a = await this.repo.findById(id);
    if (a === null) throw new NotFoundException({ code: AGENT_NOT_FOUND, message: 'Agent no encontrado' });
    if (a.clientId !== ctx.clientId) throw new ForbiddenException({ code: CROSS_TENANT_AGENT, message: 'Agent pertenece a otro client' });
    return a;
  }

  async update(ctx: TenantContext, id: string, patch: Partial<AgentRecord>): Promise<AgentRecord> {
    await this.getById(ctx, id);
    const filtered: Partial<AgentRecord> = {};
    if (patch.name !== undefined) filtered.name = patch.name;
    if (patch.description !== undefined) filtered.description = patch.description;
    if (patch.defaultLocale !== undefined) filtered.defaultLocale = patch.defaultLocale;
    if (patch.defaultTimezone !== undefined) filtered.defaultTimezone = patch.defaultTimezone;
    return this.repo.update(id, filtered);
  }

  async archive(ctx: TenantContext, id: string): Promise<void> {
    await this.getById(ctx, id);
    await this.repo.archive(id);
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.AGENT_ARCHIVED,
      resourceType: AUDIT_RESOURCE_TYPES.AGENT,
      resourceId: id,
    });
  }

  async listVersions(ctx: TenantContext, agentId: string): Promise<AgentVersionRecord[]> {
    await this.getById(ctx, agentId);
    return this.repo.listVersions(agentId);
  }

  async createVersion(
    ctx: TenantContext,
    agentId: string,
    input: Omit<AgentVersionRecord, 'id' | 'platformId' | 'agentId' | 'version' | 'state' | 'publishedAt' | 'publishedBy' | 'createdAt' | 'updatedAt'>,
  ): Promise<AgentVersionRecord> {
    const agent = await this.getById(ctx, agentId);
    const existing = await this.repo.listVersions(agent.id);
    const next = existing.length === 0 ? 1 : Math.max(...existing.map((v) => v.version)) + 1;
    return this.repo.createVersion({
      ...input,
      platformId: ctx.platformId,
      agentId: agent.id,
      version: next,
    });
  }

  async getVersion(ctx: TenantContext, versionId: string): Promise<AgentVersionRecord> {
    this.assertClientAccess(ctx);
    const v = await this.repo.findVersionById(versionId);
    if (v === null) throw new NotFoundException({ code: AGENT_VERSION_NOT_FOUND, message: 'Versión no encontrada' });
    await this.getById(ctx, v.agentId);
    return v;
  }

  async publishVersion(ctx: TenantContext, versionId: string, publishedBy: string | null): Promise<AgentVersionRecord> {
    const v = await this.getVersion(ctx, versionId);
    const updated = await this.repo.publishVersion(v.id, publishedBy);

    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.AGENT_VERSION_PUBLISHED,
      resourceType: AUDIT_RESOURCE_TYPES.AGENT_VERSION,
      resourceId: updated.id,
      metadata: { agentId: updated.agentId, version: updated.version, publishedBy },
    });

    if (this.webhooks !== undefined) {
      void this.webhooks
        .emit(
          ctx,
          'agent.published',
          {
            agentId: updated.agentId,
            agentVersionId: updated.id,
            version: updated.version,
            publishedAt: updated.publishedAt?.toISOString() ?? new Date().toISOString(),
            publishedBy,
          },
          `agent-published:${updated.id}`,
        )
        .catch(() => undefined);
    }

    return updated;
  }

  private assertClientAccess(ctx: TenantContext): void {
    if (ctx.clientId === null || ctx.clientId === undefined) {
      throw new ForbiddenException({ code: CROSS_TENANT_AGENT, message: 'Se requiere un clientId en el TenantContext' });
    }
  }
}
