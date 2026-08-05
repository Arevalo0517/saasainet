'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../../lib/api-client';

interface ClientItem {
  id: string;
  key: string;
  name: string;
  webhookAllowedHosts: string[];
}

interface AllowlistResponse {
  clientId: string;
  hosts: string[];
}

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

const validateHost = (raw: string): { ok: true; host: string } | { ok: false; reason: string } => {
  const value = raw.trim().toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '');
  if (value.length === 0) return { ok: false, reason: 'vacío' };
  if (value.length > 253) return { ok: false, reason: 'demasiado largo' };
  if (value.includes('://') || value.includes('/') || value.includes('?') || value.includes('#')) {
    return { ok: false, reason: 'no debe llevar esquema ni ruta' };
  }
  const colonIdx = value.lastIndexOf(':');
  if (colonIdx !== -1) {
    const port = value.slice(colonIdx + 1);
    if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) return { ok: false, reason: 'puerto inválido' };
  }
  return { ok: true, host: value };
};

export default function WebhooksAllowlistPage(): JSX.Element {
  const tenant = getTenant();
  const [clients, setClients] = React.useState<ClientItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(tenant?.clientId ?? null);
  const [hosts, setHosts] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadClients = React.useCallback(async (): Promise<ClientItem[]> => {
    if (tenant?.clientId !== null && tenant?.clientId !== undefined) {
      const detail = await apiFetch<ClientItem>(`/api/v1/clients/${tenant.clientId}`);
      return [detail];
    }
    const res = await apiFetch<{ items: ClientItem[] }>('/api/v1/clients');
    return res.items;
  }, [tenant?.clientId]);

  const loadAllowlist = React.useCallback(async (clientId: string): Promise<string[]> => {
    const res = await apiFetch<AllowlistResponse>(`/api/v1/clients/${clientId}/webhook-allowed-hosts`);
    return res.hosts;
  }, []);

  React.useEffect(() => {
    void (async () => {
      try {
        const list = await loadClients();
        setClients(list);
        const id = selectedId ?? list[0]?.id ?? null;
        if (id !== null) {
          setSelectedId(id);
          const hosts = await loadAllowlist(id);
          setHosts(hosts);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadClients, loadAllowlist, selectedId]);

  const onSelectClient = async (id: string): Promise<void> => {
    setSelectedId(id);
    setLoading(true);
    setError(null);
    try {
      const hosts = await loadAllowlist(id);
      setHosts(hosts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const addDraft = (): void => {
    const v = validateHost(draft);
    if (!v.ok) {
      setError(`Host inválido: ${v.reason}`);
      return;
    }
    setError(null);
    if (hosts.includes(v.host)) {
      setError(`"${v.host}" ya está en la lista`);
      return;
    }
    setHosts((h) => [...h, v.host]);
    setDraft('');
  };

  const removeHost = (h: string): void => {
    setHosts((prev) => prev.filter((x) => x !== h));
  };

  const save = async (): Promise<void> => {
    if (selectedId === null || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<AllowlistResponse>(`/api/v1/clients/${selectedId}/webhook-allowed-hosts`, {
        method: 'PATCH',
        body: JSON.stringify({ hosts }),
      });
      setHosts(res.hosts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGate>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
        <header className="flex items-center justify-between border-b border-cyan-ai/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-ai shadow-glow" />
              <span className="text-xs uppercase tracking-widest text-cyan-ai">Integraciones</span>
            </div>
            <h1 className="mt-1 bg-aurora-gradient bg-clip-text text-2xl font-bold text-transparent">
              Allowlist de webhooks
            </h1>
            <p className="text-xs text-cloud-300">
              Restringe los hosts a los que este cliente puede enviar webhooks salientes (anti SSRF).
            </p>
          </div>
          <Link
            href="/dashboard/webhooks"
            className="rounded-md border border-cloud-700/40 bg-midnight-700/30 px-3 py-1.5 text-xs text-cloud-200 hover:border-cyan-ai/60 hover:text-cyan-ai"
          >
            ← Webhooks
          </Link>
        </header>

        {clients.length > 1 && (
          <section className="midnight-card p-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-cloud-400">Cliente</span>
              <select
                className="input-midnight text-sm"
                value={selectedId ?? ''}
                onChange={(e) => void onSelectClient(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.key})
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}

        {error !== null && (
          <div className="midnight-card border-warm/50 p-3 text-xs text-warm">{error}</div>
        )}

        <section className="midnight-card p-4">
          <h2 className="text-sm font-semibold text-cyan-ai">Hosts permitidos</h2>
          <p className="mt-1 text-[10px] text-cloud-400">
            Vacío = solo HTTPS públicos (sin localhost ni privados). Añade hosts exactos o wildcards
            <span className="font-mono"> *.example.com</span> para todos los subdomains (no incluye apex).
          </p>

          <div className="mt-4 flex gap-2">
            <input
              className="input-midnight flex-1 text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addDraft();
                }
              }}
              placeholder="hooks.example.com o *.example.com"
              disabled={loading || saving}
            />
            <button
              type="button"
              onClick={addDraft}
              disabled={loading || saving || draft.length === 0}
              className="btn-warm text-xs disabled:opacity-40"
            >
              Añadir
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {hosts.length === 0 ? (
              <span className="chip chip-cloud">sin allowlist (solo https público)</span>
            ) : (
              hosts.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => removeHost(h)}
                  className="chip chip-cyan hover:chip-warm"
                  title="Quitar"
                >
                  {h} ×
                </button>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={loading || saving || selectedId === null}
              className="btn-electric text-sm disabled:opacity-40"
            >
              {saving ? 'Guardando…' : 'Guardar allowlist'}
            </button>
          </div>
        </section>
      </main>
    </AuthGate>
  );
}
