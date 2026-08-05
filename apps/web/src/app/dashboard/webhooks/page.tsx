'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../lib/api-client';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  description: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

const STATUS_CHIP: Record<WebhookEndpoint['status'], string> = {
  ACTIVE: 'chip chip-cyan',
  PAUSED: 'chip chip-warm',
  ARCHIVED: 'chip chip-cloud',
};

const STATUS_LABEL: Record<WebhookEndpoint['status'], string> = {
  ACTIVE: 'activo',
  PAUSED: 'pausado',
  ARCHIVED: 'archivado',
};

const ALL_EVENTS = ['agent.published', 'conversation.started', 'conversation.closed', 'human.reply.created'] as const;

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

export default function WebhooksPage(): JSX.Element {
  const [items, setItems] = React.useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    url: 'https://n8n.example.com/webhook/abc123',
    events: ['conversation.started', 'conversation.closed'] as string[],
    description: '',
  });
  const [busy, setBusy] = React.useState(false);
  const [revealedSecret, setRevealedSecret] = React.useState<{ id: string; secret: string } | null>(null);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const res = await apiFetch<{ items: WebhookEndpoint[] }>('/api/v1/webhook-endpoints');
      setItems(res.items);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const toggleEvent = (e: string): void => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e],
    }));
  };

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const ep = await apiFetch<WebhookEndpoint & { secret: string }>('/api/v1/webhook-endpoints', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setRevealedSecret({ id: ep.id, secret: ep.secret });
      setShowForm(false);
      setForm({ name: '', url: 'https://n8n.example.com/webhook/abc123', events: ['conversation.started'], description: '' });
      await load();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthGate>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
        <header className="flex items-center justify-between border-b border-cyan-ai/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-ai shadow-glow" />
              <span className="text-xs uppercase tracking-widest text-cyan-ai">Integraciones</span>
            </div>
            <h1 className="mt-1 bg-aurora-gradient bg-clip-text text-2xl font-bold text-transparent">
              Webhooks salientes
            </h1>
            <p className="text-xs text-cloud-300">
              {loading ? 'Cargando…' : `${items.filter((e) => e.status === 'ACTIVE').length} activos · ${items.length} total`}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-md border border-cloud-700/40 bg-midnight-700/30 px-3 py-1.5 text-xs text-cloud-200 hover:border-cyan-ai/60 hover:text-cyan-ai"
            >
              ← Dashboard
            </Link>
            <Link
              href="/dashboard/webhooks/allowlist"
              className="rounded-md border border-cyan-ai/40 bg-midnight-700/30 px-3 py-1.5 text-xs text-cyan-ai hover:border-cyan-ai/80"
            >
              Allowlist
            </Link>
            <button type="button" onClick={() => setShowForm((s) => !s)} className="btn-warm text-xs">
              {showForm ? 'Cancelar' : 'Nuevo endpoint'}
            </button>
          </div>
        </header>

        {revealedSecret !== null && (
          <div className="midnight-card border-warm/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-warm">
              secret generado (guárdalo, no se mostrará de nuevo)
            </div>
            <pre className="mt-2 overflow-auto rounded bg-midnight-900/60 p-3 font-mono text-[11px] text-cyan-ai">
{revealedSecret.secret}
            </pre>
            <button
              type="button"
              onClick={() => setRevealedSecret(null)}
              className="mt-2 text-[10px] text-cloud-300 underline"
            >
              cerrar
            </button>
          </div>
        )}

        {showForm && (
          <section className="midnight-card p-4">
            <h2 className="text-sm font-semibold text-cyan-ai">Crear endpoint</h2>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-cloud-400">Nombre</span>
                <input
                  className="input-midnight text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="n8n produccion"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-cloud-400">URL</span>
                <input
                  className="input-midnight text-sm"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..."
                />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-cloud-400">Eventos</span>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_EVENTS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => toggleEvent(e)}
                      className={`chip ${form.events.includes(e) ? 'chip-cyan' : 'chip-cloud'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-cloud-400">Descripción (opcional)</span>
                <input
                  className="input-midnight text-sm"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || form.name.length === 0 || form.events.length === 0}
                className="btn-electric text-sm disabled:opacity-40"
              >
                {busy ? 'Creando…' : 'Crear endpoint'}
              </button>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-2">
          {items.map((ep) => (
            <Link key={ep.id} href={`/dashboard/webhooks/${ep.id}`} className="midnight-card flex items-center justify-between p-3">
              <div>
                <div className="font-mono text-xs text-cyan-ai">{ep.id.slice(0, 8)}…</div>
                <div className="text-sm text-cloud">{ep.name}</div>
                <div className="text-[10px] text-cloud-400 break-all">{ep.url}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ep.events.map((e) => (
                    <span key={e} className="chip chip-electric">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
              <span className={STATUS_CHIP[ep.status]}>{STATUS_LABEL[ep.status]}</span>
            </Link>
          ))}
          {!loading && items.length === 0 && (
            <div className="midnight-card p-6 text-center text-sm text-cloud-300">
              Aún no tienes endpoints. Crea uno para empezar a recibir eventos en n8n.
            </div>
          )}
        </section>
      </main>
    </AuthGate>
  );
}
