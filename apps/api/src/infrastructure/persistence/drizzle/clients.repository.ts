import { eq } from 'drizzle-orm';
import type { Database } from '@platform/db';
import { clients } from '@platform/db';

export class DrizzleClientsRepository {
  constructor(private readonly db: Database) {}

  async getWebhookAllowedHosts(clientId: string): Promise<readonly string[]> {
    const rows = await this.db
      .select({ webhookAllowedHosts: clients.webhookAllowedHosts })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);
    const row = rows[0];
    if (row === undefined) return [];
    return row.webhookAllowedHosts ?? [];
  }

  async setWebhookAllowedHosts(clientId: string, hosts: readonly string[]): Promise<readonly string[]> {
    const normalized = Array.from(new Set(hosts.map((h) => h.trim().toLowerCase()).filter((h) => h.length > 0)));
    const rows = await this.db
      .update(clients)
      .set({ webhookAllowedHosts: normalized, updatedAt: new Date() })
      .where(eq(clients.id, clientId))
      .returning({ webhookAllowedHosts: clients.webhookAllowedHosts });
    const row = rows[0];
    if (row === undefined) return [];
    return row.webhookAllowedHosts;
  }
}
