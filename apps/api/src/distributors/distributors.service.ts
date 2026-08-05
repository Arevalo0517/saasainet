import { ForbiddenException, BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { HostnameValidationError, normalizeHostList, type TenantContext } from '@platform/contracts';
import type {
  DrizzleDistributorRepository,
  DrizzleClientRepository,
  DistributorRecord,
  ClientRecord,
} from '../infrastructure/persistence/drizzle/distributors.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleClientsRepository } from '../infrastructure/persistence/drizzle/clients.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditService, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../audit/audit.service.js';
import { CLIENTS_REPO_TOKEN } from '../webhooks/webhooks.tokens.js';


export const DISTRIBUTOR_NOT_FOUND = 'DISTRIBUTOR_NOT_FOUND';
export const CLIENT_NOT_FOUND = 'CLIENT_NOT_FOUND';
export const CROSS_TENANT_ACCESS = 'CROSS_TENANT_ACCESS';

@Injectable()
export class DistributorService {
  constructor(
    private readonly repo: DrizzleDistributorRepository,
    @Optional() private readonly audit: AuditService | null = null,
  ) {}

  async list(ctx: TenantContext): Promise<DistributorRecord[]> {
    if (ctx.isSupportSession || isPlatformSuperAdmin(ctx)) {
      return this.repo.listByPlatform(ctx.platformId);
    }
    if (ctx.distributorId === null || ctx.distributorId === undefined) {
      return [];
    }
    const d = await this.repo.findById(ctx.distributorId);
    return d === null ? [] : [d];
  }

  async getById(ctx: TenantContext, id: string): Promise<DistributorRecord> {
    const d = await this.repo.findById(id);
    if (d === null) throw new NotFoundException({ code: DISTRIBUTOR_NOT_FOUND, message: 'Distribuidor no encontrado' });
    this.assertCanRead(ctx, d);
    return d;
  }

  async create(ctx: TenantContext, input: Omit<DistributorRecord, 'createdAt' | 'updatedAt'>): Promise<DistributorRecord> {
    if (!isPlatformSuperAdmin(ctx)) {
      throw new ForbiddenException({ code: CROSS_TENANT_ACCESS, message: 'Solo platform_admin puede crear distribuidores' });
    }
    if (input.platformId !== ctx.platformId) {
      throw new ForbiddenException({ code: CROSS_TENANT_ACCESS, message: 'platformId no coincide con tu scope' });
    }
    const created = await this.repo.create(input);
    this.audit?.record({
      ctx: { ...ctx, distributorId: created.id, clientId: null },
      action: AUDIT_ACTIONS.DISTRIBUTOR_CREATED,
      resourceType: AUDIT_RESOURCE_TYPES.DISTRIBUTOR,
      resourceId: created.id,
      metadata: { key: created.key, name: created.name },
    });
    return created;
  }

  async update(ctx: TenantContext, id: string, patch: Partial<DistributorRecord>): Promise<DistributorRecord> {
    const d = await this.repo.findById(id);
    if (d === null) throw new NotFoundException({ code: DISTRIBUTOR_NOT_FOUND, message: 'Distribuidor no encontrado' });
    this.assertCanWrite(ctx, d);
    const updated = await this.repo.update(id, patch);
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.DISTRIBUTOR_UPDATED,
      resourceType: AUDIT_RESOURCE_TYPES.DISTRIBUTOR,
      resourceId: id,
      metadata: { fields: Object.keys(patch) },
    });
    return updated;
  }

  private assertCanRead(ctx: TenantContext, d: DistributorRecord): void {
    if (isPlatformSuperAdmin(ctx) || ctx.isSupportSession) return;
    if (d.id === ctx.distributorId) return;
    throw new ForbiddenException({ code: CROSS_TENANT_ACCESS, message: 'No tienes acceso a este distribuidor' });
  }

  private assertCanWrite(ctx: TenantContext, d: DistributorRecord): void {
    if (isPlatformSuperAdmin(ctx)) return;
    if (d.id === ctx.distributorId && ctx.roles.some((r) => r === 'distributor_owner' || r === 'distributor_admin')) return;
    throw new ForbiddenException({ code: CROSS_TENANT_ACCESS, message: 'No tienes permisos para modificar este distribuidor' });
  }
}

export const DISTRIBUTOR_SCOPE_KEY = 'distributor_id';

export const isPlatformSuperAdmin = (ctx: TenantContext): boolean =>
  ctx.roles.includes('platform_super_admin');

@Injectable()
export class ClientService {
  constructor(
    private readonly repo: DrizzleClientRepository,
    @Inject(CLIENTS_REPO_TOKEN) private readonly webhookHosts: DrizzleClientsRepository,
    @Optional() private readonly audit: AuditService | null = null,
  ) {}

  async list(ctx: TenantContext): Promise<ClientRecord[]> {
    if (isPlatformSuperAdmin(ctx) || ctx.isSupportSession) {
      return this.repo.listByPlatform(ctx.platformId);
    }
    if (ctx.clientId !== null && ctx.clientId !== undefined) {
      const c = await this.repo.findById(ctx.clientId);
      return c === null ? [] : [c];
    }
    if (ctx.distributorId !== null && ctx.distributorId !== undefined) {
      return this.repo.listByDistributor(ctx.distributorId);
    }
    return [];
  }

  async getById(ctx: TenantContext, id: string): Promise<ClientRecord> {
    const c = await this.repo.findById(id);
    if (c === null) throw new NotFoundException({ code: CLIENT_NOT_FOUND, message: 'Cliente no encontrado' });
    this.assertCanRead(ctx, c);
    return c;
  }

  async create(ctx: TenantContext, input: Omit<ClientRecord, 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<ClientRecord> {
    if (isPlatformSuperAdmin(ctx)) {
      const created = await this.repo.create(input);
      this.audit?.record({
        ctx: { ...ctx, clientId: created.id, distributorId: created.distributorId },
        action: AUDIT_ACTIONS.CLIENT_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.CLIENT,
        resourceId: created.id,
        metadata: { key: created.key, name: created.name },
      });
      return created;
    }
    if (
      ctx.distributorId === null ||
      ctx.distributorId === undefined ||
      ctx.distributorId !== input.distributorId ||
      !ctx.roles.some((r) => r === 'distributor_owner' || r === 'distributor_admin')
    ) {
      throw new ForbiddenException({
        code: CROSS_TENANT_ACCESS,
        message: 'Solo distributor_owner/admin puede crear clientes en su distribuidor',
      });
    }
    const created = await this.repo.create(input);
    this.audit?.record({
      ctx: { ...ctx, clientId: created.id, distributorId: created.distributorId },
      action: AUDIT_ACTIONS.CLIENT_CREATED,
      resourceType: AUDIT_RESOURCE_TYPES.CLIENT,
      resourceId: created.id,
      metadata: { key: created.key, name: created.name },
    });
    return created;
  }

  async update(ctx: TenantContext, id: string, patch: Partial<ClientRecord>): Promise<ClientRecord> {
    const c = await this.repo.findById(id);
    if (c === null) throw new NotFoundException({ code: CLIENT_NOT_FOUND, message: 'Cliente no encontrado' });
    this.assertCanWrite(ctx, c);
    const updated = await this.repo.update(id, patch);
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.CLIENT_UPDATED,
      resourceType: AUDIT_RESOURCE_TYPES.CLIENT,
      resourceId: id,
      metadata: { fields: Object.keys(patch) },
    });
    return updated;
  }

  async softDelete(ctx: TenantContext, id: string): Promise<ClientRecord> {
    const c = await this.repo.findById(id);
    if (c === null) throw new NotFoundException({ code: CLIENT_NOT_FOUND, message: 'Cliente no encontrado' });
    this.assertCanDelete(ctx, c);
    const updated = await this.repo.softDelete(id);
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.CLIENT_ARCHIVED,
      resourceType: AUDIT_RESOURCE_TYPES.CLIENT,
      resourceId: id,
    });
    return updated;
  }

  async getWebhookAllowedHosts(ctx: TenantContext, id: string): Promise<string[]> {
    const c = await this.repo.findById(id);
    if (c === null) throw new NotFoundException({ code: CLIENT_NOT_FOUND, message: 'Cliente no encontrado' });
    this.assertCanRead(ctx, c);
    return [...(await this.webhookHosts.getWebhookAllowedHosts(id))];
  }

  async updateWebhookAllowedHosts(ctx: TenantContext, id: string, hosts: readonly unknown[]): Promise<string[]> {
    const c = await this.repo.findById(id);
    if (c === null) throw new NotFoundException({ code: CLIENT_NOT_FOUND, message: 'Cliente no encontrado' });
    this.assertCanWrite(ctx, c);
    const previous = [...(await this.webhookHosts.getWebhookAllowedHosts(id))];
    let normalized: string[];
    try {
      normalized = normalizeHostList(hosts);
    } catch (err) {
      if (err instanceof HostnameValidationError) {
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
    const saved = await this.webhookHosts.setWebhookAllowedHosts(id, normalized);
    const added = normalized.filter((h) => !previous.includes(h));
    const removed = previous.filter((h) => !normalized.includes(h));
    this.audit?.record({
      ctx,
      action: AUDIT_ACTIONS.CLIENT_WEBHOOK_ALLOWLIST_UPDATED,
      resourceType: AUDIT_RESOURCE_TYPES.CLIENT,
      resourceId: id,
      metadata: { added, removed, totalAfter: saved.length },
    });
    return [...saved];
  }

  private assertCanRead(ctx: TenantContext, c: ClientRecord): void {
    if (isPlatformSuperAdmin(ctx) || ctx.isSupportSession) return;
    if (c.distributorId === ctx.distributorId) return;
    if (c.id === ctx.clientId) return;
    throw new ForbiddenException({ code: CROSS_TENANT_ACCESS, message: 'No tienes acceso a este cliente' });
  }

  private assertCanWrite(ctx: TenantContext, c: ClientRecord): void {
    if (isPlatformSuperAdmin(ctx)) return;
    if (
      c.distributorId === ctx.distributorId &&
      ctx.roles.some((r) => r === 'distributor_owner' || r === 'distributor_admin')
    ) return;
    throw new ForbiddenException({ code: CROSS_TENANT_ACCESS, message: 'No tienes permisos para modificar este cliente' });
  }

  private assertCanDelete(ctx: TenantContext, c: ClientRecord): void {
    if (isPlatformSuperAdmin(ctx)) return;
    if (c.distributorId === ctx.distributorId && ctx.roles.includes('distributor_owner')) return;
    throw new ForbiddenException({ code: CROSS_TENANT_ACCESS, message: 'Solo distributor_owner puede eliminar clientes' });
  }
}
