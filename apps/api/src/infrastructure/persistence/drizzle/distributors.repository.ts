import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '@platform/db';
import { distributors, clients, type Distributor, type Client } from '@platform/db';

export type DistributorRecord = {
  id: string;
  platformId: string;
  key: string;
  name: string;
  legalName: string;
  supportEmail: string | null;
  billingEmail: string | null;
  defaultLocale: string;
  defaultCurrency: string;
  whiteLabelEnabled: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customDomain: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  createdAt: Date;
  updatedAt: Date;
};

export type ClientRecord = {
  id: string;
  platformId: string;
  distributorId: string;
  key: string;
  name: string;
  legalName: string;
  supportEmail: string | null;
  billingEmail: string | null;
  defaultLocale: string;
  defaultCurrency: string;
  webhookAllowedHosts: string[];
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const toDistributor = (row: Distributor): DistributorRecord => ({
  id: row.id,
  platformId: row.platformId,
  key: row.key,
  name: row.name,
  legalName: row.legalName,
  supportEmail: row.supportEmail,
  billingEmail: row.billingEmail,
  defaultLocale: row.defaultLocale,
  defaultCurrency: row.defaultCurrency,
  whiteLabelEnabled: row.whiteLabelEnabled,
  logoUrl: row.logoUrl,
  primaryColor: row.primaryColor,
  secondaryColor: row.secondaryColor,
  customDomain: row.customDomain,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toClient = (row: Client): ClientRecord => ({
  id: row.id,
  platformId: row.platformId,
  distributorId: row.distributorId,
  key: row.key,
  name: row.name,
  legalName: row.legalName,
  supportEmail: row.supportEmail,
  billingEmail: row.billingEmail,
  defaultLocale: row.defaultLocale,
  defaultCurrency: row.defaultCurrency,
  webhookAllowedHosts: row.webhookAllowedHosts,
  status: row.status,
  deletedAt: row.deletedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class DrizzleDistributorRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<DistributorRecord | null> {
    const rows = await this.db.select().from(distributors).where(eq(distributors.id, id)).limit(1);
    const row = rows[0];
    return row ? toDistributor(row) : null;
  }

  async findByKey(platformId: string, key: string): Promise<DistributorRecord | null> {
    const rows = await this.db
      .select()
      .from(distributors)
      .where(and(eq(distributors.platformId, platformId), eq(distributors.key, key)))
      .limit(1);
    const row = rows[0];
    return row ? toDistributor(row) : null;
  }

  async listByPlatform(platformId: string): Promise<DistributorRecord[]> {
    const rows = await this.db
      .select()
      .from(distributors)
      .where(eq(distributors.platformId, platformId))
      .orderBy(asc(distributors.name));
    return rows.map(toDistributor);
  }

  async create(input: Omit<DistributorRecord, 'createdAt' | 'updatedAt'>): Promise<DistributorRecord> {
    const rows = await this.db
      .insert(distributors)
      .values({
        id: input.id,
        platformId: input.platformId,
        key: input.key,
        name: input.name,
        legalName: input.legalName,
        supportEmail: input.supportEmail,
        billingEmail: input.billingEmail,
        defaultLocale: input.defaultLocale,
        defaultCurrency: input.defaultCurrency,
        whiteLabelEnabled: input.whiteLabelEnabled,
        logoUrl: input.logoUrl,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        customDomain: input.customDomain,
        status: input.status,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error('No se pudo crear el distribuidor');
    return toDistributor(row);
  }

  async update(
    id: string,
    patch: Partial<Omit<DistributorRecord, 'id' | 'platformId' | 'createdAt'>>,
  ): Promise<DistributorRecord> {
    const rows = await this.db
      .update(distributors)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(distributors.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new Error(`Distribuidor ${id} no existe`);
    return toDistributor(row);
  }
}

export class DrizzleClientRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<ClientRecord | null> {
    const rows = await this.db
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .limit(1);
    const row = rows[0];
    return row ? toClient(row) : null;
  }

  async listByDistributor(distributorId: string): Promise<ClientRecord[]> {
    const rows = await this.db
      .select()
      .from(clients)
      .where(and(eq(clients.distributorId, distributorId), isNull(clients.deletedAt)))
      .orderBy(asc(clients.name));
    return rows.map(toClient);
  }

  async listByPlatform(platformId: string): Promise<ClientRecord[]> {
    const rows = await this.db
      .select()
      .from(clients)
      .where(and(eq(clients.platformId, platformId), isNull(clients.deletedAt)))
      .orderBy(asc(clients.name));
    return rows.map(toClient);
  }

  async create(input: Omit<ClientRecord, 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<ClientRecord> {
    const rows = await this.db
      .insert(clients)
      .values({
        id: input.id,
        platformId: input.platformId,
        distributorId: input.distributorId,
        key: input.key,
        name: input.name,
        legalName: input.legalName,
        supportEmail: input.supportEmail,
        billingEmail: input.billingEmail,
        defaultLocale: input.defaultLocale,
        defaultCurrency: input.defaultCurrency,
        status: input.status,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error('No se pudo crear el cliente');
    return toClient(row);
  }

  async update(
    id: string,
    patch: Partial<Omit<ClientRecord, 'id' | 'platformId' | 'distributorId' | 'createdAt'>>,
  ): Promise<ClientRecord> {
    const rows = await this.db
      .update(clients)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new Error(`Cliente ${id} no existe`);
    return toClient(row);
  }

  async softDelete(id: string): Promise<ClientRecord> {
    const rows = await this.db
      .update(clients)
      .set({ deletedAt: sql`now()`, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new Error(`Cliente ${id} no existe`);
    return toClient(row);
  }

  async countByDistributor(distributorId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(and(eq(clients.distributorId, distributorId), isNull(clients.deletedAt)));
    return Number(rows[0]?.count ?? 0);
  }
}

export class DrizzleTenantRepository {
  constructor(
    private readonly distributors: DrizzleDistributorRepository,
    private readonly clients: DrizzleClientRepository,
  ) {}

  async listDistributorsForPlatform(platformId: string): Promise<DistributorRecord[]> {
    return this.distributors.listByPlatform(platformId);
  }

  async listClientsForDistributor(distributorId: string): Promise<ClientRecord[]> {
    return this.clients.listByDistributor(distributorId);
  }

  async _platformDistributorCount(platformId: string): Promise<number> {
    const list = await this.distributors.listByPlatform(platformId);
    return list.length;
  }
}
