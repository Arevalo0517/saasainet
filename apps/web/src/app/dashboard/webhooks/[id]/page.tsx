'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../../lib/api-client';

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
  secret?: string;
}

interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventId: string;
  status: 'PENDING' | 'IN_FLIGHT' | 'SUCCEEDED' | 'FAILED' | 'DLQ';
  attemptCount: number;
  maxAttempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  responseBody: string | null;
  nextRetryAt: string | null;
  lastAttemptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const DELIVERY_CHIP: Record<WebhookDelivery['status'], string> = {
  PENDING: 'chip chip-electric',
  IN_FLIGHT: 'chip chip-cyan',
  SUCCEEDED: 'chip chip-cyan',
  FAILED: 'chip chip-warm',
  DLQ: 'chip chip-warm',
};

const DELIVERY_LABEL: Record<WebhookDelivery['status'], string> = {
  PENDING: 'pendiente',
  IN_FLIGHT: 'enviando',
  SUCCEEDED: 'ok',
  FAILED: 'falló',
  DLQ: 'DLQ',
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

import { useRouter } from 'next/navigation';

export default function WebhookDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [ep, setEp] = React.useState<WebhookEndpoint | null>(null);
  const [deliveries, setDeliveries] = React.useState<WebhookDelivery[]>([]);
  const [revealedSecret, setRevealedSecret] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const e = await apiFetch<WebhookEndpoint>(`/api/v1/webhook-endpoints/${id}`);
      setEp(e);
      const d = await apiFetch<{ items: WebhookDelivery[] }>(`/api/v1/webhook-deliveries?endpointId=${id}`);
      setDeliveries(d.items);
    } catch (err) {
      window.alert((err as Error).message);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 4_000);
    return () => window.clearInterval(t);
  }, [load]);

  const toggleStatus = async (): Promise<void> => {
    if (ep === null || busy) return;
    setBusy(true);
    try {
      const next: 'ACTIVE' | 'PAUSED' = ep.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      const updated = await apiFetch<WebhookEndpoint>(`/api/v1/webhook-endpoints/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setEp(updated);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch<{ eventId: string; type: string }>(`/api/v1/webhook-endpoints/${id}/test`, { method: 'POST' });
      await load();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rotateSecret = async (): Promise<void> => {
    if (busy) return;
    if (!window.confirm('¿Rotar el secret? El webhook receptor deberá actualizarse.')) return;
    setBusy(true);
    try {
      const r = await apiFetch<WebhookEndpoint>(`/api/v1/webhook-endpoints/${id}/rotate-secret`, { method: 'POST' });
      setRevealedSecret(r.secret ?? null);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const replay = async (deliveryId: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch<WebhookDelivery>(`/api/v1/webhook-deliveries/${deliveryId}/replay`, { method: 'POST' });
      await load();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (ep === null) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-6">
        <span className="text-sm text-cloud-300">Cargando endpoint…</span>
      </main>
    );
  }

  return (
    <AuthGate>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-6">
        <header className="flex items-center justify-between border-b border-cyan-ai/20 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-ai shadow-glow" />
              <span className="text-xs uppercase tracking-widest text-cyan-ai">Endpoint</span>
            </div>
            <h1 className="mt-1 bg-aurora-gradient bg-clip-text text-xl font-bold text-transparent">{ep.name}</h1>
            <div className="mt-1 break-all font-mono text-xs text-cloud-300">{ep.url}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {ep.events.map((e) => (
                <span key={e} className="chip chip-electric">
                  {e}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/dashboard/webhooks"
              className="rounded-md border border-cloud-700/40 bg-midnight-700/30 px-3 py-1.5 text-xs text-cloud-200 hover:border-cyan-ai/60 hover:text-cyan-ai"
            >
              ← Webhooks
            </Link>
            <button
              type="button"
              onClick={() => void toggleStatus()}
              disabled={busy}
              className="rounded-md border border-cyan-ai/40 bg-cyan-ai/10 px-3 py-1.5 text-xs text-cyan-ai hover:bg-cyan-ai/20"
            >
              {ep.status === 'ACTIVE' ? 'Pausar' : 'Activar'}
            </button>
          </div>
        </header>

        {revealedSecret !== null && (
          <div className="midnight-card border-warm/50 p-3">
            <div className="text-[10px] uppercase tracking-widest text-warm">nuevo secret</div>
            <pre className="mt-1 overflow-auto rounded bg-midnight-900/60 p-2 font-mono text-[11px] text-cyan-ai">
{revealedSecret}
            </pre>
            <button type="button" onClick={() => setRevealedSecret(null)} className="mt-1 text-[10px] text-cloud-300 underline">
              cerrar
            </button>
          </div>
        )}

        <section className="midnight-card flex flex-wrap items-center justify-between gap-2 p-3">
          <div>
            <h2 className="text-sm font-semibold text-cyan-ai">Acciones</h2>
            <p className="text-[11px] text-cloud-300">
              Emite un evento de prueba, rota el secret HMAC o reintenta deliveries fallidas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void sendTest()}
              disabled={busy}
              className="btn-electric text-xs disabled:opacity-40"
            >
              Enviar evento de prueba
            </button>
            <button
              type="button"
              onClick={() => void rotateSecret()}
              disabled={busy}
              className="rounded-md border border-warm/40 bg-warm/10 px-3 py-1.5 text-xs text-warm hover:bg-warm/20"
            >
              Rotar secret
            </button>
          </div>
        </section>

        <section className="midnight-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-cyan-ai">Entregas</h2>
            <span className="text-[10px] text-cloud-400">
              {deliveries.length} entrega{deliveries.length === 1 ? '' : 's'} (poll 4s)
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded border border-midnight-700/40 bg-midnight-900/40 p-2">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className={DELIVERY_CHIP[d.status]}>{DELIVERY_LABEL[d.status]}</span>
                    <span className="font-mono text-[11px] text-cyan-ai">{d.id.slice(0, 8)}…</span>
                    {d.lastStatusCode !== null && (
                      <span className="font-mono text-[10px] text-cloud-300">HTTP {d.lastStatusCode}</span>
                    )}
                    <span className="text-[10px] text-cloud-400">intento {d.attemptCount}/{d.maxAttempts}</span>
                  </div>
                  {d.lastError !== null && <div className="text-[10px] text-warm">{d.lastError}</div>}
                  {d.responseBody !== null && d.responseBody.length > 0 && (
                    <pre className="mt-1 max-h-20 overflow-auto rounded bg-midnight-700/40 p-1 font-mono text-[10px] text-cloud-200">
{d.responseBody.slice(0, 500)}
                    </pre>
                  )}
                </div>
                {(d.status === 'PENDING' || d.status === 'FAILED' || d.status === 'DLQ') && (
                  <button
                    type="button"
                    onClick={() => void replay(d.id)}
                    disabled={busy}
                    className="rounded-md border border-cyan-ai/40 bg-cyan-ai/10 px-2 py-1 text-[10px] text-cyan-ai hover:bg-cyan-ai/20 disabled:opacity-40"
                  >
                    Reintentar
                  </button>
                )}
              </li>
            ))}
            {deliveries.length === 0 && (
              <li className="p-3 text-center text-xs text-cloud-400">
                Sin entregas todavía. Pulsa &quot;Enviar evento de prueba&quot; o espera a que se emita un evento.
              </li>
            )}
          </ul>
        </section>
      </main>
    </AuthGate>
  );
}
