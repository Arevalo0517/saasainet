'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getTenant } from '../../../lib/api-client';

interface AuditEvent {
  id: string;
  platformId: string;
  distributorId: string;
  clientId: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditResponse {
  items: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

const ACTIONS = [
  '',
  'webhook_endpoint.created',
  'webhook_endpoint.updated',
  'webhook_endpoint.secret_rotated',
  'webhook_endpoint.archived',
  'channel_connection.created',
  'channel_connection.updated',
  'channel_connection.verified',
  'channel_connection.secret_rotated',
  'channel_connection.archived',
  'client.created',
  'client.updated',
  'client.archived',
  'client.webhook_allowlist_updated',
  'distributor.created',
  'distributor.updated',
  'agent_version.published',
  'agent.archived',
];

const RESOURCES = ['', 'webhook_endpoint', 'channel_connection', 'client', 'distributor', 'agent_version', 'agent'];

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
};

const actionBadgeClass = (action: string): string => {
  if (action.endsWith('.archived') || action.endsWith('.secret_rotated')) return 'chip-warm';
  if (action.endsWith('.created')) return 'chip-cyan';
  if (action.endsWith('.updated') || action.endsWith('.allowlist_updated')) return 'chip-electric';
  if (action.endsWith('.published') || action.endsWith('.verified')) return 'chip-cloud';
  return 'chip-cloud';
};

const stringifyMetadata = (m: Record<string, unknown>): string => {
  const keys = Object.keys(m);
  if (keys.length === 0) return '—';
  return keys
    .slice(0, 4)
    .map((k) => {
      const v = m[k];
      if (v === null || v === undefined) return `${k}:—`;
      if (Array.isArray(v)) return `${k}:[${v.length}]`;
      if (typeof v === 'object') return `${k}:{…}`;
      return `${k}:${String(v).slice(0, 24)}`;
    })
    .join(' · ');
};

const AuthGate = ({ children }: { children: React.ReactNode }): JSX.Element | null => {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const t = getTenant();
    if (t === null) router.replace('/login');
    else setReady(true);
  }, [router]);
  if (!ready) return null;
  return <>{children}</>;
};

export default function AuditPage(): JSX.Element {
  const tenant = getTenant();
  const [items, setItems] = React.useState<AuditEvent[]>([]);
  const [total, setTotal] = React.useState(0);
  const [limit] = React.useState(50);
  const [offset, setOffset] = React.useState(0);
  const [action, setAction] = React.useState('');
  const [resourceType, setResourceType] = React.useState('');
  const [actorUserId, setActorUserId] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (off: number): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        params.set('offset', String(off));
        if (action !== '') params.set('action', action);
        if (resourceType !== '') params.set('resourceType', resourceType);
        if (actorUserId.trim() !== '') params.set('actorUserId', actorUserId.trim());
        if (from !== '') params.set('from', new Date(from).toISOString());
        if (to !== '') params.set('to', new Date(to).toISOString());
        const res = await apiFetch<AuditResponse>(`/audit-events?${params.toString()}`);
        setItems(res.items);
        setTotal(res.total);
        setOffset(off);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    },
    [limit, action, resourceType, actorUserId, from, to],
  );

  React.useEffect(() => {
    void load(0);
  }, [load]);

  if (tenant === null) return <div />;

  const hasNext = offset + limit < total;
  const hasPrev = offset > 0;

  return (
    <AuthGate>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-cloud">Audit log</h1>
          <p className="mt-1 text-sm text-cloud/60">
            Eventos de seguridad y operaciones tenant-scoped. {total} resultado{total === 1 ? '' : 's'}.
          </p>
        </header>

        <section className="midnight-card mb-6 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <label className="block text-xs">
              <span className="mb-1 block text-cloud/60">Acción</span>
              <select className="input-midnight w-full" value={action} onChange={(e) => setAction(e.target.value)}>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a === '' ? 'todas' : a}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-cloud/60">Recurso</span>
              <select className="input-midnight w-full" value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
                {RESOURCES.map((r) => (
                  <option key={r} value={r}>
                    {r === '' ? 'todos' : r}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-cloud/60">Actor user ID</span>
              <input
                type="text"
                className="input-midnight w-full"
                placeholder="uuid…"
                value={actorUserId}
                onChange={(e) => setActorUserId(e.target.value)}
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-cloud/60">Desde</span>
              <input type="datetime-local" className="input-midnight w-full" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-cloud/60">Hasta</span>
              <input type="datetime-local" className="input-midnight w-full" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <div className="flex items-end">
              <button type="button" className="btn-electric w-full" onClick={() => void load(0)} disabled={loading}>
                {loading ? 'Buscando…' : 'Aplicar'}
              </button>
            </div>
          </div>
        </section>

        {error !== null && (
          <div className="midnight-card mb-4 p-3 text-sm text-warm">
            Error: {error}
          </div>
        )}

        <section className="midnight-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-midnight/40 text-xs uppercase text-cloud/50">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Recurso</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-cloud/50">
                      Sin eventos en el rango seleccionado.
                    </td>
                  </tr>
                )}
                {items.map((ev) => (
                  <tr key={ev.id} className="border-b border-midnight/20 align-top hover:bg-midnight/30">
                    <td className="px-4 py-3 font-mono text-xs text-cloud/70">{formatDate(ev.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`chip ${actionBadgeClass(ev.action)}`}>{ev.action}</span>
                    </td>
                    <td className="px-4 py-3 text-cloud/80">
                      <div className="font-mono text-xs">{ev.resourceType}</div>
                      <div className="font-mono text-[10px] text-cloud/40">{ev.resourceId.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3 text-cloud/80">
                      <div className="text-xs">{ev.actorUserId === null ? '—' : ev.actorUserId.slice(0, 8) + '…'}</div>
                      {ev.actorRole !== null && <div className="text-[10px] text-cloud/50">{ev.actorRole}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-cloud/70">{stringifyMetadata(ev.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-midnight/40 px-4 py-3 text-xs text-cloud/60">
            <span>
              Mostrando {items.length === 0 ? 0 : offset + 1}–{offset + items.length} de {total}
            </span>
            <div className="flex gap-2">
              <button type="button" className="btn-electric disabled:opacity-40" disabled={!hasPrev || loading} onClick={() => void load(Math.max(0, offset - limit))}>
                ← Anterior
              </button>
              <button type="button" className="btn-electric disabled:opacity-40" disabled={!hasNext || loading} onClick={() => void load(offset + limit)}>
                Siguiente →
              </button>
            </div>
          </div>
        </section>
      </div>
    </AuthGate>
  );
}
