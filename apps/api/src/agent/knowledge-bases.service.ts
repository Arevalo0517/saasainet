import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantContext } from '@platform/contracts';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleKnowledgeBaseRepository, type KnowledgeBaseRecord } from '../infrastructure/persistence/drizzle/knowledge.repository.js';

export const KB_NOT_FOUND = 'KB_NOT_FOUND';
export const CROSS_TENANT_KB = 'CROSS_TENANT_KB';

@Injectable()
export class KnowledgeBasesService {
  constructor(private readonly repo: DrizzleKnowledgeBaseRepository) {}

  async list(ctx: TenantContext, includeArchived: boolean): Promise<KnowledgeBaseRecord[]> {
    this.assertClientAccess(ctx);
    return this.repo.listByClient(ctx.clientId as string, includeArchived);
  }

  async getById(ctx: TenantContext, id: string): Promise<KnowledgeBaseRecord> {
    this.assertClientAccess(ctx);
    const k = await this.repo.findById(id);
    if (k === null) throw new NotFoundException({ code: KB_NOT_FOUND, message: 'Knowledge base no encontrada' });
    if (k.clientId !== ctx.clientId) throw new ForbiddenException({ code: CROSS_TENANT_KB, message: 'KB pertenece a otro client' });
    return k;
  }

  async create(
    ctx: TenantContext,
    input: Omit<KnowledgeBaseRecord, 'id' | 'platformId' | 'distributorId' | 'clientId' | 'status' | 'createdAt' | 'updatedAt' | 'archivedAt'>,
  ): Promise<KnowledgeBaseRecord> {
    this.assertClientAccess(ctx);
    return this.repo.create({
      ...input,
      platformId: ctx.platformId,
      distributorId: ctx.distributorId as string,
      clientId: ctx.clientId as string,
    });
  }

  async update(ctx: TenantContext, id: string, patch: Partial<KnowledgeBaseRecord>): Promise<KnowledgeBaseRecord> {
    await this.getById(ctx, id);
    const filtered: Partial<KnowledgeBaseRecord> = {};
    if (patch.name !== undefined) filtered.name = patch.name;
    if (patch.description !== undefined) filtered.description = patch.description;
    if (patch.embeddingModel !== undefined) filtered.embeddingModel = patch.embeddingModel;
    if (patch.embeddingDimensions !== undefined) filtered.embeddingDimensions = patch.embeddingDimensions;
    if (patch.agentId !== undefined) filtered.agentId = patch.agentId;
    if (patch.status !== undefined) filtered.status = patch.status;
    return this.repo.update(id, filtered);
  }

  async archive(ctx: TenantContext, id: string): Promise<void> {
    await this.getById(ctx, id);
    await this.repo.archive(id);
  }

  private assertClientAccess(ctx: TenantContext): void {
    if (ctx.clientId === null || ctx.clientId === undefined) {
      throw new ForbiddenException({ code: CROSS_TENANT_KB, message: 'Se requiere un clientId en el TenantContext' });
    }
  }
}
