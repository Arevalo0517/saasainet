'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../../lib/api-client';
import type { Agent, AgentVersion } from '../../../../lib/agent-types';

const STATE_CHIP: Record<AgentVersion['state'], string> = {
  DRAFT: 'chip chip-cloud',
  TESTING: 'chip chip-electric',
  PUBLISHED: 'chip chip-cyan',
  PAUSED: 'chip chip-warm',
  ARCHIVED: 'chip chip-cloud',
};

export default function AgentDetailPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [agent, setAgent] = React.useState<Agent | null>(null);
  const [versions, setVersions] = React.useState<AgentVersion[]>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    systemPrompt:
      'Eres un agente de soporte amable. Responde en español, sé conciso y cita la knowledge base cuando la uses.',
    knowledgeBaseId: '',
  });
  const [busy, setBusy] = React.useState(false);
  const [widgetId, setWidgetId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (getTenant() === null) {
      router.replace('/login');
      return;
    }
    void (async (): Promise<void> => {
      try {
        const a = await apiFetch<Agent & { publicWidgetId?: string }>(`/api/v1/agents/${id}`);
        setAgent(a);
        setWidgetId(a.publicWidgetId ?? null);
        const v = await apiFetch<{ items: AgentVersion[] }>(`/api/v1/agents/${id}/versions`);
        setVersions(v.items);
      } catch (err) {
        window.alert((err as Error).message);
      }
    })();
  }, [id, router]);

  const onCreateVersion = async (): Promise<void> => {
    setBusy(true);
    try {
      const modelParameters: Record<string, unknown> = {};
      if (form.knowledgeBaseId.length > 0) {
        modelParameters['knowledgeBaseIds'] = [form.knowledgeBaseId];
      }
      await apiFetch(`/api/v1/agents/${id}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          systemPrompt: form.systemPrompt,
          modelParameters,
        }),
      });
      setShowForm(false);
      setForm((f) => ({ ...f, name: '' }));
      const v = await apiFetch<{ items: AgentVersion[] }>(`/api/v1/agents/${id}/versions`);
      setVersions(v.items);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async (versionId: string): Promise<void> => {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/agents/${id}/versions/${versionId}/publish`, { method: 'POST' });
      const v = await apiFetch<{ items: AgentVersion[] }>(`/api/v1/agents/${id}/versions`);
      setVersions(v.items);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (agent === null) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-6">
        <span className="text-sm text-cloud-300">Cargando agent…</span>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b border-cyan-ai/20 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-ai shadow-glow" />
            <span className="text-xs uppercase tracking-widest text-cyan-ai">Agent</span>
          </div>
          <h1 className="mt-1 bg-aurora-gradient bg-clip-text text-2xl font-bold text-transparent">
            {agent.name}
          </h1>
          <p className="font-mono text-xs text-cyan-ai">{agent.key}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/chat?agentId=${agent.id}`}
            className="btn-warm text-xs"
          >
            Probar chat
          </Link>
          <Link
            href="/dashboard/agents"
            className="rounded-md border border-cloud-700/40 bg-midnight-700/30 px-3 py-1.5 text-xs text-cloud-200 hover:border-cyan-ai/60 hover:text-cyan-ai"
          >
            ← Agentes
          </Link>
        </div>
      </header>

      {widgetId !== null && (
        <section className="midnight-card p-4">
          <h2 className="text-sm font-semibold text-cyan-ai">Embed widget</h2>
          <p className="mt-1 text-xs text-cloud-300">
            Pega este snippet en cualquier página HTML. La primera vez pedirá el chat en la esquina
            inferior derecha.
          </p>
          <pre className="mt-3 overflow-auto rounded bg-midnight-900/60 p-3 font-mono text-[11px] text-cyan-ai">
{`<script>
  (function() {
    var s = document.createElement('script');
    s.src = '${typeof window !== 'undefined' ? window.location.origin : ''}/widget.js';
    s.async = true;
    s.onload = function() {
      window.PlatformWidget.init('${widgetId}', { apiUrl: '${typeof window !== 'undefined' ? window.location.origin : ''}' });
    };
    document.head.appendChild(s);
  })();
</script>`}
          </pre>
          <div className="mt-2 flex items-center gap-2 text-xs text-cloud-300">
            <span className="font-mono text-cloud-200">publicWidgetId:</span>
            <code className="rounded bg-midnight-900/60 px-2 py-0.5 font-mono text-cyan-ai">
              {widgetId}
            </code>
          </div>
        </section>
      )}

      <section className="midnight-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-cyan-ai">Versiones</h2>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="btn-electric text-xs"
          >
            {showForm ? 'Cancelar' : 'Nueva versión'}
          </button>
        </div>

        {showForm && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-cyan-ai/20 pt-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs text-cloud-300">Nombre de la versión</span>
              <input
                className="input-midnight mt-1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Soporte v2 — KB horarios"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs text-cloud-300">System prompt</span>
              <textarea
                className="input-midnight mt-1 h-32 font-mono text-xs"
                value={form.systemPrompt}
                onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs text-cloud-300">Knowledge Base ID (opcional, pega el UUID)</span>
              <input
                className="input-midnight mt-1 font-mono text-xs"
                value={form.knowledgeBaseId}
                onChange={(e) => setForm((f) => ({ ...f, knowledgeBaseId: e.target.value }))}
                placeholder="a0000002-0000-4000-8000-000000000002"
              />
            </label>
            <div className="flex justify-end sm:col-span-2">
              <button
                type="button"
                onClick={() => void onCreateVersion()}
                disabled={busy || form.name.length === 0 || form.systemPrompt.length === 0}
                className="btn-electric disabled:opacity-40"
              >
                {busy ? 'Creando…' : 'Crear versión'}
              </button>
            </div>
          </div>
        )}

        <ul className="mt-4 flex flex-col gap-2">
          {versions.length === 0 && (
            <li className="rounded-md border border-cloud-700/30 bg-midnight-700/30 p-3 text-sm text-cloud-300">
              Aún no hay versiones. Crea la primera.
            </li>
          )}
          {versions.map((v) => (
            <li
              key={v.id}
              className="rounded-md border border-cyan-ai/15 bg-midnight-700/30 p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-cloud">v{v.version} · {v.name}</div>
                  <div className="text-xs text-cloud-400">
                    {v.publishedAt !== null
                      ? `Publicada ${new Date(v.publishedAt).toLocaleString()}`
                      : 'No publicada'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={STATE_CHIP[v.state]}>{v.state}</span>
                  {v.state !== 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => void onPublish(v.id)}
                      disabled={busy}
                      className="rounded-md border border-cyan-ai/40 bg-cyan-ai/10 px-2 py-1 text-xs text-cyan-ai hover:bg-cyan-ai/20 disabled:opacity-40"
                    >
                      Publicar
                    </button>
                  )}
                </div>
              </div>
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-midnight-900/60 p-2 font-mono text-[11px] text-cloud-300">
                {v.systemPrompt}
              </pre>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
