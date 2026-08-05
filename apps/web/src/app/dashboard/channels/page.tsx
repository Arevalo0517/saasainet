'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../lib/api-client';

interface ChannelConnection {
  id: string;
  name: string;
  channel: 'WHATSAPP' | 'TELEGRAM' | 'MESSENGER' | 'INSTAGRAM';
  phoneNumber: string | null;
  status: 'NOT_CONFIGURED' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'ARCHIVED';
  lastError: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  archivedAt: string | null;
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

export default function ChannelsPage(): JSX.Element {
  const [items, setItems] = React.useState<ChannelConnection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'ALL' | ChannelConnection['channel']>('ALL');
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ items: ChannelConnection[] }>('/api/v1/channel-connections?includeArchived=false');
      setItems(res.items.filter((c) => c.archivedAt === null));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const t = setInterval(() => { void load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = filter === 'ALL' ? items : items.filter((c) => c.channel === filter);

  const channels: Array<'ALL' | ChannelConnection['channel']> = ['ALL', 'WHATSAPP', 'TELEGRAM', 'MESSENGER', 'INSTAGRAM'];

  return (
    <AuthGate>
      <div className="midnight-card mx-auto mt-10 max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Conexiones de canal</h1>
            <p className="text-sm text-cloud-300">WhatsApp, Telegram, Messenger, Instagram. Cada cliente puede tener una conexión activa por canal.</p>
          </div>
          <Link href="/dashboard/channels/new" className="btn-electric">+ Nueva conexión</Link>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {channels.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={filter === c ? 'chip chip-electric' : 'chip chip-cloud'}
            >
              {c === 'ALL' ? 'Todos' : CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>

        {error !== null && (
          <div className="mb-4 rounded border border-electric-500/40 bg-electric-500/10 p-3 text-sm text-electric-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-cloud-300">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded border border-dashed border-cloud-700 p-8 text-center">
            <p className="text-cloud-300">No hay conexiones para este filtro.</p>
            <p className="mt-1 text-sm text-cloud-400">Crea una para empezar a recibir mensajes desde canales externos.</p>
          </div>
        ) : (
          <ul className="divide-y divide-cloud-800">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/channels/${c.id}`} className="truncate text-base font-semibold text-white hover:underline">
                      {c.name}
                    </Link>
                    <span className="chip chip-cloud">{CHANNEL_LABEL[c.channel]}</span>
                    <span className={STATUS_CHIP[c.status]}>{STATUS_LABEL[c.status]}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-cloud-400">
                    {c.phoneNumber ?? 'sin número'} · id {c.id.slice(0, 8)}…
                  </p>
                  {c.lastError !== null && (
                    <p className="mt-1 truncate text-xs text-electric-300" title={c.lastError}>último error: {c.lastError}</p>
                  )}
                </div>
                <Link href={`/dashboard/channels/${c.id}`} className="btn-warm">Abrir</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AuthGate>
  );
}
