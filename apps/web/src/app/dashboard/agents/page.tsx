'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../lib/api-client';
import type { Agent, AgentVersion } from '../../../lib/agent-types';

const STATE_CHIP: Record<AgentVersion['state'], string> = {
  DRAFT: 'chip chip-cloud',
  TESTING: 'chip chip-electric',
  PUBLISHED: 'chip chip-cyan',
  PAUSED: 'chip chip-warm',
  ARCHIVED: 'chip chip-cloud',
};

const Shell = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
    <header className="flex items-center justify-between border-b border-cyan-ai/20 pb-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-cyan-ai shadow-glow" />
          <span className="text-xs uppercase tracking-widest text-cyan-ai">Agentes AI</span>
        </div>
        <h1 className="mt-1 bg-aurora-gradient bg-clip-text text-2xl font-bold text-transparent">
          Agentes
        </h1>
      </div>
      <Link
        href="/dashboard"
        className="rounded-md border border-cloud-700/40 bg-midnight-700/30 px-3 py-1.5 text-xs text-cloud-200 hover:border-cyan-ai/60 hover:text-cyan-ai"
      >
        ← Dashboard
      </Link>
    </header>
    {children}
  </main>
);

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

const AgentCard = ({
  agent,
  versions,
  onDeleted,
}: {
  agent: Agent;
  versions: AgentVersion[];
  onDeleted: (id: string) => void;
}): JSX.Element => {
  const published = versions.find((v) => v.state === 'PUBLISHED');
  return (
    <article className="midnight-card group p-4 transition">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-cloud">{agent.name}</h2>
          <p className="font-mono text-xs text-cyan-ai">{agent.key}</p>
          {agent.description !== null && (
            <p className="mt-1 text-sm text-cloud-300">{agent.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={STATE_CHIP[published ? 'PUBLISHED' : 'DRAFT']}>
            {published ? `${published.version} publicada` : 'sin versión publicada'}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-cloud-400">
            {agent.defaultLocale} · {agent.defaultTimezone}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {versions.map((v) => (
          <span key={v.id} className={STATE_CHIP[v.state]}>
            v{v.version} · {v.state.toLowerCase()}
          </span>
        ))}
        {versions.length === 0 && <span className="chip chip-cloud">sin versiones</span>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/agents/${agent.id}`}
          className="rounded-md border border-cyan-ai/40 bg-cyan-ai/10 px-3 py-1.5 text-xs text-cyan-ai hover:bg-cyan-ai/20"
        >
          Detalle y versiones
        </Link>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`¿Archivar agent "${agent.name}"?`)) {
              void apiFetch(`/api/v1/agents/${agent.id}`, { method: 'DELETE' })
                .then(() => onDeleted(agent.id))
                .catch((err) => window.alert(err.message));
            }
          }}
          className="rounded-md border border-warm/40 bg-warm/10 px-3 py-1.5 text-xs text-warm hover:bg-warm/20"
        >
          Archivar
        </button>
      </div>
    </article>
  );
};

export default function AgentsPage(): JSX.Element {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [versionsByAgent, setVersionsByAgent] = React.useState<Record<string, AgentVersion[]>>({});
  const [loaded, setLoaded] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ key: '', name: '', description: '' });
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const res = await apiFetch<{ items: Agent[] }>('/api/v1/agents');
      setAgents(res.items);
      const map: Record<string, AgentVersion[]> = {};
      for (const a of res.items) {
        const v = await apiFetch<{ items: AgentVersion[] }>(`/api/v1/agents/${a.id}/versions`);
        map[a.id] = v.items;
      }
      setVersionsByAgent(map);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/agents', {
        method: 'POST',
        body: JSON.stringify({
          key: form.key,
          name: form.name,
          description: form.description.length > 0 ? form.description : undefined,
        }),
      });
      setForm({ key: '', name: '', description: '' });
      setShowForm(false);
      setLoaded(false);
      await load();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthGate>
      <Shell>
        <section className="flex items-center justify-between">
          <p className="text-sm text-cloud-300">
            {loaded
              ? `${agents.length} agent${agents.length === 1 ? '' : 's'} activos`
              : 'Cargando…'}
          </p>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="btn-electric"
          >
            {showForm ? 'Cancelar' : 'Nuevo agent'}
          </button>
        </section>

        {showForm && (
          <section className="midnight-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-cyan-ai">Crear agent</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs text-cloud-300">Key (slug)</span>
                <input
                  className="input-midnight mt-1 font-mono"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="soporte-24-7"
                />
              </label>
              <label className="block">
                <span className="text-xs text-cloud-300">Nombre</span>
                <input
                  className="input-midnight mt-1"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Agente de Soporte 24/7"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-xs text-cloud-300">Descripción</span>
                <input
                  className="input-midnight mt-1"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Atención al cliente con KB"
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void onCreate()}
                disabled={submitting || form.key.length === 0 || form.name.length === 0}
                className="btn-electric disabled:opacity-40"
              >
                {submitting ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {agents.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              versions={versionsByAgent[a.id] ?? []}
              onDeleted={(id) =>
                setAgents((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))}
          {loaded && agents.length === 0 && (
            <div className="md:col-span-2 midnight-card p-6 text-center text-sm text-cloud-300">
              Aún no tienes agents. Crea el primero con "Nuevo agent".
            </div>
          )}
        </section>
      </Shell>
    </AuthGate>
  );
}
