'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../lib/api-client';
import type { Conversation } from '../../../lib/agent-types';

const STATE_CHIP: Record<Conversation['state'], string> = {
  NEW: 'chip chip-electric',
  AI_ACTIVE: 'chip chip-cyan',
  WAITING_CUSTOMER: 'chip chip-electric',
  HUMAN_REQUIRED: 'chip chip-warm',
  ASSIGNED: 'chip chip-cyan',
  FOLLOW_UP: 'chip chip-electric',
  RESOLVED: 'chip chip-cloud',
  CLOSED: 'chip chip-cloud',
};

const STATE_LABEL: Record<Conversation['state'], string> = {
  NEW: 'nueva',
  AI_ACTIVE: 'AI activo',
  WAITING_CUSTOMER: 'esperando cliente',
  HUMAN_REQUIRED: 'requiere humano',
  ASSIGNED: 'asignada',
  FOLLOW_UP: 'seguimiento',
  RESOLVED: 'resuelta',
  CLOSED: 'cerrada',
};

const AuthGate = ({ children }: { children: React.ReactNode }): JSX.Element | null => {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    if (getTenant() === null) router.replace('/login');
    else setReady(true);
  }, [router]);
  if (!ready) return null;
  return <>{children}</>;
};

export default function InboxPage(): JSX.Element {
  const [items, setItems] = React.useState<Conversation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<Conversation['state'] | 'ALL'>('ALL');

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const res = await apiFetch<{ items: Conversation[] }>('/api/v1/conversations');
      setItems(res.items);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(t);
  }, [load]);

  const filtered = filter === 'ALL' ? items : items.filter((c) => c.state === filter);

  return (
    <AuthGate>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
        <header className="flex items-center justify-between border-b border-cyan-ai/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-warm shadow-glow" />
              <span className="text-xs uppercase tracking-widest text-warm">Inbox</span>
            </div>
            <h1 className="mt-1 bg-aurora-gradient bg-clip-text text-2xl font-bold text-transparent">
              Conversaciones
            </h1>
            <p className="text-xs text-cloud-300">
              {loading ? 'Cargando…' : `${items.length} total · ${items.filter((c) => c.state === 'AI_ACTIVE').length} activas con IA`}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-md border border-cloud-700/40 bg-midnight-700/30 px-3 py-1.5 text-xs text-cloud-200 hover:border-cyan-ai/60 hover:text-cyan-ai"
          >
            ← Dashboard
          </Link>
        </header>

        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'AI_ACTIVE', 'HUMAN_REQUIRED', 'WAITING_CUSTOMER', 'CLOSED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`chip ${filter === s ? 'chip-cyan' : 'chip-cloud'}`}
            >
              {s === 'ALL' ? 'todas' : STATE_LABEL[s as Conversation['state']]}
            </button>
          ))}
        </div>

        <section className="grid grid-cols-1 gap-2">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/inbox/${c.id}`}
              className="midnight-card flex items-center justify-between p-3"
            >
              <div>
                <div className="font-mono text-xs text-cyan-ai">{c.id.slice(0, 8)}…</div>
                <div className="text-sm text-cloud">
                  {c.customerDisplayName ?? c.customerExternalId ?? 'anónimo'}
                </div>
                <div className="text-[10px] text-cloud-400">
                  {c.lastMessageAt !== null ? new Date(c.lastMessageAt).toLocaleString() : 'sin mensajes'}
                  {' · '}
                  {c.messageCount} mensaje{c.messageCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={STATE_CHIP[c.state]}>{STATE_LABEL[c.state]}</span>
                <span className="text-[10px] uppercase tracking-widest text-cloud-400">{c.channel}</span>
              </div>
            </Link>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="midnight-card p-6 text-center text-sm text-cloud-300">
              {items.length === 0
                ? 'Aún no hay conversaciones. Lanza el widget o usa POST /chat para crear la primera.'
                : 'Ninguna conversación coincide con el filtro.'}
            </div>
          )}
        </section>
      </main>
    </AuthGate>
  );
}
