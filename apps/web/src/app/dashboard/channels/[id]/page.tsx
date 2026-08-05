'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../../lib/api-client';

interface ChannelConnection {
  id: string;
  name: string;
  channel: 'WHATSAPP' | 'TELEGRAM' | 'MESSENGER' | 'INSTAGRAM';
  phoneNumber: string | null;
  status: 'NOT_CONFIGURED' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'ARCHIVED';
  lastError: string | null;
  lastVerifiedAt: string | null;
  webhookUrl: string;
  createdAt: string;
  archivedAt: string | null;
}

interface MessageDelivery {
  id: string;
  conversationId: string;
  messageId: string;
  channel: string;
  channelConnectionId: string;
  providerMessageId: string | null;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RETRYING';
  errorCode: string | null;
  errorMessage: string | null;
  attemptedAt: string;
  deliveredAt: string | null;
  readAt: string | null;
}

const STATUS_CHIP: Record<ChannelConnection['status'], string> = {
  NOT_CONFIGURED: 'chip chip-cloud',
  CONNECTED: 'chip chip-cyan',
  DISCONNECTED: 'chip chip-warm',
  ERROR: 'chip chip-electric',
  ARCHIVED: 'chip chip-cloud',
};

const STATUS_LABEL: Record<ChannelConnection['status'], string> = {
  NOT_CONFIGURED: 'sin configurar',
  CONNECTED: 'conectado',
  DISCONNECTED: 'desconectado',
  ERROR: 'con error',
  ARCHIVED: 'archivado',
};

const DELIVERY_CHIP: Record<MessageDelivery['status'], string> = {
  QUEUED: 'chip chip-cloud',
  SENT: 'chip chip-cyan',
  DELIVERED: 'chip chip-cyan',
  READ: 'chip chip-cyan',
  FAILED: 'chip chip-electric',
  RETRYING: 'chip chip-warm',
};

const CHANNEL_LABEL: Record<ChannelConnection['channel'], string> = {
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  MESSENGER: 'Messenger',
  INSTAGRAM: 'Instagram',
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

export default function ChannelDetailPage({ params }: { params: { id: string } }): JSX.Element {
  const [conn, setConn] = React.useState<ChannelConnection | null>(null);
  const [deliveries, setDeliveries] = React.useState<MessageDelivery[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<'verify' | 'rotate' | 'archive' | null>(null);
  const [revealedSecret, setRevealedSecret] = React.useState<string | null>(null);

  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const c = await apiFetch<ChannelConnection>(`/api/v1/channel-connections/${params.id}`);
      setConn(c);
      try {
        const d = await apiFetch<{ items: MessageDelivery[] }>(`/api/v1/message-deliveries?connectionId=${params.id}&limit=20`);
        setDeliveries(d.items);
      } catch {
        setDeliveries([]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const t = setInterval(() => { void load(); }, 6000);
    return () => clearInterval(t);
  }, [load]);

  const verify = async (): Promise<void> => {
    setBusy('verify');
    setError(null);
    try {
      const updated = await apiFetch<ChannelConnection>(`/api/v1/channel-connections/${params.id}/verify`, { method: 'POST' });
      setConn(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const rotate = async (): Promise<void> => {
    setBusy('rotate');
    setError(null);
    try {
      const updated = await apiFetch<{ webhookSecret: string }>(`/api/v1/channel-connections/${params.id}/rotate-webhook-secret`, { method: 'POST' });
      setRevealedSecret(updated.webhookSecret);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const archive = async (): Promise<void> => {
    if (!confirm('¿Archivar esta conexión? Las nuevas conversaciones no la usarán, pero las deliveries históricas se conservan.')) return;
    setBusy('archive');
    setError(null);
    try {
      const updated = await apiFetch<ChannelConnection>(`/api/v1/channel-connections/${params.id}/archive`, { method: 'POST' });
      setConn(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <AuthGate><div className="midnight-card mx-auto mt-10 max-w-4xl p-8 text-cloud-300">Cargando…</div></AuthGate>;
  if (conn === null) return <AuthGate><div className="midnight-card mx-auto mt-10 max-w-4xl p-8 text-electric-200">{error ?? 'No encontrada.'}</div></AuthGate>;

  return (
    <AuthGate>
      <div className="mx-auto mt-10 max-w-4xl space-y-6">
        <div className="midnight-card p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{conn.name}</h1>
                <span className="chip chip-cloud">{CHANNEL_LABEL[conn.channel]}</span>
                <span className={STATUS_CHIP[conn.status]}>{STATUS_LABEL[conn.status]}</span>
              </div>
              <p className="mt-1 text-xs text-cloud-400">id {conn.id}</p>
            </div>
            <Link href="/dashboard/channels" className="btn-cloud">← Volver</Link>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-cloud-400">Teléfono</dt>
              <dd className="text-cloud-100">{conn.phoneNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-cloud-400">Última verificación</dt>
              <dd className="text-cloud-100">{conn.lastVerifiedAt !== null ? new Date(conn.lastVerifiedAt).toLocaleString() : '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-cloud-400">Webhook URL</dt>
              <dd className="break-all font-mono text-xs text-cyan-200">{conn.webhookUrl}</dd>
            </div>
            {conn.lastError !== null && (
              <div className="col-span-2">
                <dt className="text-cloud-400">Último error</dt>
                <dd className="rounded bg-electric-500/10 p-2 text-sm text-electric-200">{conn.lastError}</dd>
              </div>
            )}
          </dl>

          {error !== null && (
            <div className="mt-4 rounded border border-electric-500/40 bg-electric-500/10 p-3 text-sm text-electric-200">{error}</div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="btn-electric" disabled={busy !== null} onClick={() => void verify()}>
              {busy === 'verify' ? 'Verificando…' : 'Verificar conexión'}
            </button>
            <button type="button" className="btn-warm" disabled={busy !== null} onClick={() => void rotate()}>
              {busy === 'rotate' ? 'Rotando…' : 'Rotar webhook secret'}
            </button>
            {conn.archivedAt === null && (
              <button type="button" className="btn-cloud" disabled={busy !== null} onClick={() => void archive()}>
                {busy === 'archive' ? 'Archivando…' : 'Archivar'}
              </button>
            )}
          </div>

          {revealedSecret !== null && (
            <div className="mt-4 rounded border border-electric-500/40 bg-electric-500/10 p-4 text-sm">
              <p className="font-semibold text-electric-100">Nuevo webhook secret (guárdalo, no se mostrará de nuevo):</p>
              <code className="mt-2 block break-all rounded bg-midnight-900 p-2 text-electric-200">{revealedSecret}</code>
            </div>
          )}
        </div>

        <div className="midnight-card p-8">
          <h2 className="mb-4 text-lg font-semibold text-white">Deliveries recientes</h2>
          {deliveries.length === 0 ? (
            <p className="text-sm text-cloud-400">Aún no hay deliveries. Las conversaciones nuevas en este canal empezarán a aparecer aquí.</p>
          ) : (
            <ul className="divide-y divide-cloud-800">
              {deliveries.map((d) => (
                <li key={d.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={DELIVERY_CHIP[d.status]}>{d.status}</span>
                        <span className="font-mono text-xs text-cloud-300">{d.providerMessageId ?? '—'}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-cloud-400">
                        intento {new Date(d.attemptedAt).toLocaleString()} · conv {d.conversationId.slice(0, 8)}…
                      </p>
                      {d.errorMessage !== null && (
                        <p className="mt-1 truncate text-xs text-electric-300" title={d.errorMessage}>{d.errorCode}: {d.errorMessage}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AuthGate>
  );
}
