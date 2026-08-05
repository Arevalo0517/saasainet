import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '@platform/db';
import {
  agents,
  agentVersions,
  type Agent,
  type AgentVersion,
  type NewAgent,
  type NewAgentVersion,
} from '@platform/db';

export type AgentRecord = Agent;
export type AgentVersionRecord = AgentVersion;

export class DrizzleAgentRepository {
  constructor(private readonly db: Database) {}

  async listByClient(clientId: string, includeArchived: boolean): Promise<AgentRecord[]> {
    const q = this.db
      .select()
      .from(agents)
      .where(includeArchived ? eq(agents.clientId, clientId) : and(eq(agents.clientId, clientId), sql`${agents.archivedAt} IS NULL`))
      .orderBy(asc(agents.name));
    return q;
  }

  async findById(id: string): Promise<AgentRecord | null> {
    const rows = await this.db.select().from(agents).where(eq(agents.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByClientAndKey(clientId: string, key: string): Promise<AgentRecord | null> {
    const rows = await this.db
      .select()
      .from(agents)
      .where(and(eq(agents.clientId, clientId), eq(agents.key, key)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByPublicWidgetId(publicWidgetId: string): Promise<AgentRecord | null> {
    const rows = await this.db
      .select()
      .from(agents)
      .where(and(eq(agents.publicWidgetId, publicWidgetId), sql`${agents.archivedAt} IS NULL`))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: NewAgent): Promise<AgentRecord> {
    const rows = await this.db.insert(agents).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('agent create returned no rows');
    return r;
  }

  async update(id: string, patch: Partial<AgentRecord>): Promise<AgentRecord> {
    const rows = await this.db
      .update(agents)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    const r = rows[0];
    if (!r) throw new Error('agent update returned no rows');
    return r;
  }

  async archive(id: string): Promise<void> {
    await this.db.update(agents).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(agents.id, id));
  }

  async listVersions(agentId: string): Promise<AgentVersionRecord[]> {
    return this.db.select().from(agentVersions).where(eq(agentVersions.agentId, agentId)).orderBy(desc(agentVersions.version));
  }

  async findVersionById(id: string): Promise<AgentVersionRecord | null> {
    const rows = await this.db.select().from(agentVersions).where(eq(agentVersions.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findLatestPublishedVersion(agentId: string): Promise<AgentVersionRecord | null> {
    const rows = await this.db
      .select()
      .from(agentVersions)
      .where(and(eq(agentVersions.agentId, agentId), eq(agentVersions.state, 'PUBLISHED')))
      .orderBy(desc(agentVersions.version))
      .limit(1);
    return rows[0] ?? null;
  }

  async createVersion(input: NewAgentVersion): Promise<AgentVersionRecord> {
    const rows = await this.db.insert(agentVersions).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('agent_version create returned no rows');
    return r;
  }

  async updateVersion(id: string, patch: Partial<AgentVersionRecord>): Promise<AgentVersionRecord> {
    const rows = await this.db
      .update(agentVersions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(agentVersions.id, id))
      .returning();
    const r = rows[0];
    if (!r) throw new Error('agent_version update returned no rows');
    return r;
  }

  async publishVersion(id: string, publishedBy: string | null): Promise<AgentVersionRecord> {
    const rows = await this.db
      .update(agentVersions)
      .set({ state: 'PUBLISHED', publishedAt: new Date(), publishedBy, updatedAt: new Date() })
      .where(eq(agentVersions.id, id))
      .returning();
    const r = rows[0];
    if (!r) throw new Error('agent_version publish returned no rows');
    return r;
  }
}
