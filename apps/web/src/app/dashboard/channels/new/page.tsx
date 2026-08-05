'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../../lib/api-client';

const CHANNELS = ['WHATSAPP', 'TELEGRAM', 'MESSENGER', 'INSTAGRAM'] as const;
type ChannelType = (typeof CHANNELS)[number];

const CHANNEL_LABEL: Record<ChannelType, string> = {
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

interface Created {
  id: string;
  name: string;
  channel: ChannelType;
  phoneNumber: string | null;
  status: string;
  webhookUrl: string;
  webhookSecret: string;
}

export default function NewChannelPage(): JSX.Element {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: '',
    channel: 'WHATSAPP' as ChannelType,
    phoneNumber: '',
    credentialsJson: '{\n  "phone_number_id": "1234567890",\n  "api_key": "EAABmocksuperlongkey"\n}',
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<Created | null>(null);

  const create = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const credentials = JSON.parse(form.credentialsJson) as Record<string, unknown>;
      const res = await apiFetch<Created>('/api/v1/channel-connections', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          channel: form.channel,
          phoneNumber: form.phoneNumber.length > 0 ? form.phoneNumber : null,
          credentials,
        }),
      });
      setCreated(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthGate>
      <div className="midnight-card mx-auto mt-10 max-w-3xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Nueva conexión de canal</h1>
          <Link href="/dashboard/channels" className="btn-cloud">← Volver</Link>
        </div>

        {created === null ? (
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="text-cloud-200">Nombre interno</span>
              <input
                className="input-midnight mt-1 w-full"
                placeholder="Soporte WhatsApp principal"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-cloud-200">Canal</span>
              <select
                className="input-midnight mt-1 w-full"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as ChannelType })}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-cloud-200">Número de teléfono (opcional)</span>
              <input
                className="input-midnight mt-1 w-full"
                placeholder="+15555550123"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-cloud-200">Credenciales (JSON)</span>
              <textarea
                className="input-midnight mt-1 h-48 w-full font-mono text-xs"
                value={form.credentialsJson}
                onChange={(e) => setForm({ ...form, credentialsJson: e.target.value })}
              />
              <span className="mt-1 block text-xs text-cloud-400">
                El adapter mock espera <code>api_key</code> (≥8 chars) y <code>phone_number_id</code> (≥3 chars). Se almacenan cifradas.
              </span>
            </label>

            {error !== null && (
              <div className="rounded border border-electric-500/40 bg-electric-500/10 p-3 text-sm text-electric-200">{error}</div>
            )}

            <div className="flex justify-end gap-2">
              <Link href="/dashboard/channels" className="btn-cloud">Cancelar</Link>
              <button type="button" className="btn-electric" disabled={busy || form.name.length === 0} onClick={() => void create()}>
                {busy ? 'Creando…' : 'Crear conexión'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              <p className="font-semibold">✓ Conexión creada</p>
              <p className="mt-1 text-cloud-200">ID: <code>{created.id}</code> · Canal: {CHANNEL_LABEL[created.channel]}</p>
            </div>
            <div className="rounded border border-electric-500/30 bg-electric-500/10 p-4 text-sm">
              <p className="font-semibold text-electric-100">⚠ Guarda el webhook secret (solo se muestra una vez)</p>
              <code className="mt-2 block break-all rounded bg-midnight-900 p-2 text-electric-200">{created.webhookSecret}</code>
              <p className="mt-2 text-cloud-200">URL del webhook para configurar en tu proveedor:</p>
              <code className="mt-1 block break-all rounded bg-midnight-900 p-2 text-cloud-200">{created.webhookUrl}</code>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-electric" onClick={() => router.push(`/dashboard/channels/${created.id}`)}>
                Abrir detalle →
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
