'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../lib/api-client';
import type { KnowledgeBase, Document } from '../../../lib/agent-types';

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

const STATUS_CHIP: Record<KnowledgeBase['status'], string> = {
  ACTIVE: 'chip chip-cyan',
  PAUSED: 'chip chip-warm',
  ARCHIVED: 'chip chip-cloud',
};

export default function KnowledgeBasesPage(): JSX.Element {
  const [kbs, setKbs] = React.useState<KnowledgeBase[]>([]);
  const [docs, setDocs] = React.useState<Record<string, Document[]>>({});
  const [loaded, setLoaded] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', description: '' });
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const res = await apiFetch<{ items: KnowledgeBase[] }>('/api/v1/knowledge-bases');
      setKbs(res.items);
      const map: Record<string, Document[]> = {};
      for (const k of res.items) {
        const d = await apiFetch<{ items: Document[] }>(
          `/api/v1/knowledge-bases/${k.id}/documents`,
        );
        map[k.id] = d.items;
      }
      setDocs(map);
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
    setBusy(true);
    try {
      await apiFetch('/api/v1/knowledge-bases', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description.length > 0 ? form.description : undefined,
        }),
      });
      setForm({ name: '', description: '' });
      setShowForm(false);
      setLoaded(false);
      await load();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onArchive = async (id: string): Promise<void> => {
    if (!window.confirm('¿Archivar KB?')) return;
    try {
      await apiFetch(`/api/v1/knowledge-bases/${id}`, { method: 'DELETE' });
      setKbs((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  return (
    <AuthGate>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
        <header className="flex items-center justify-between border-b border-cyan-ai/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-ai shadow-glow" />
              <span className="text-xs uppercase tracking-widest text-cyan-ai">
                Knowledge bases
              </span>
            </div>
            <h1 className="mt-1 bg-aurora-gradient bg-clip-text text-2xl font-bold text-transparent">
              Bases de conocimiento
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="btn-electric"
            >
              {showForm ? 'Cancelar' : 'Nueva KB'}
            </button>
            <Link
              href="/dashboard"
              className="rounded-md border border-cloud-700/40 bg-midnight-700/30 px-3 py-1.5 text-xs text-cloud-200 hover:border-cyan-ai/60 hover:text-cyan-ai"
            >
              ← Dashboard
            </Link>
          </div>
        </header>

        {showForm && (
          <section className="midnight-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-cyan-ai">Crear knowledge base</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-cloud-300">Nombre</span>
                <input
                  className="input-midnight mt-1"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Horarios y políticas"
                />
              </label>
              <label className="block">
                <span className="text-xs text-cloud-300">Descripción</span>
                <input
                  className="input-midnight mt-1"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="FAQs operativas"
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void onCreate()}
                disabled={busy || form.name.length === 0}
                className="btn-electric disabled:opacity-40"
              >
                {busy ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {kbs.map((k) => (
            <KbCard
              key={k.id}
              kb={k}
              documents={docs[k.id] ?? []}
              onArchive={onArchive}
              onAdded={() => void load()}
            />
          ))}
          {loaded && kbs.length === 0 && (
            <div className="md:col-span-2 midnight-card p-6 text-center text-sm text-cloud-300">
              Aún no hay KBs. Crea la primera con "Nueva KB".
            </div>
          )}
        </section>
      </main>
    </AuthGate>
  );
}

const KbCard = ({
  kb,
  documents,
  onArchive,
  onAdded,
}: {
  kb: KnowledgeBase;
  documents: Document[];
  onArchive: (id: string) => void;
  onAdded: () => void;
}): JSX.Element => {
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const onAddDoc = async (): Promise<void> => {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/knowledge-bases/${kb.id}/documents`, {
        method: 'POST',
        body: JSON.stringify({ title, text }),
      });
      setTitle('');
      setText('');
      setAdding(false);
      onAdded();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="midnight-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-cloud">{kb.name}</h2>
          {kb.description !== null && (
            <p className="mt-1 text-sm text-cloud-300">{kb.description}</p>
          )}
          <p className="mt-1 font-mono text-[10px] text-cyan-ai">{kb.embeddingModel}</p>
        </div>
        <span className={STATUS_CHIP[kb.status]}>{kb.status}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-cloud-300">
          {documents.length} documento{documents.length === 1 ? '' : 's'}
        </span>
        {documents.slice(0, 3).map((d) => (
          <span key={d.id} className="chip chip-cloud">
            {d.title} · {d.chunkCount} chunks
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAdding((s) => !s)}
          className="rounded-md border border-cyan-ai/40 bg-cyan-ai/10 px-3 py-1.5 text-xs text-cyan-ai hover:bg-cyan-ai/20"
        >
          {adding ? 'Cancelar' : 'Agregar documento'}
        </button>
        <button
          type="button"
          onClick={() => onArchive(kb.id)}
          className="rounded-md border border-warm/40 bg-warm/10 px-3 py-1.5 text-xs text-warm hover:bg-warm/20"
        >
          Archivar
        </button>
      </div>
      {adding && (
        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-cyan-ai/20 pt-3">
          <input
            className="input-midnight text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del documento"
          />
          <textarea
            className="input-midnight h-32 text-xs font-mono"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Texto a vectorizar (chunks de ~800 chars)"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void onAddDoc()}
              disabled={busy || title.length === 0 || text.length === 0}
              className="btn-electric text-xs disabled:opacity-40"
            >
              {busy ? 'Procesando…' : 'Ingerir'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
