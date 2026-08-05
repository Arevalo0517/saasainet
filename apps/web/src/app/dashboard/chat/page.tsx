'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../lib/api-client';
import type { Agent, ChatResult } from '../../../lib/agent-types';

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

type ChatTurn = {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  citations: Array<{ documentId: string; chunkId: string; position: number }>;
  latencyMs?: number;
};

export default function ChatTestPage(): JSX.Element {
  return (
    <React.Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-6">
          <span className="text-sm text-cloud-300">Cargando chat…</span>
        </main>
      }
    >
      <ChatTestInner />
    </React.Suspense>
  );
}

function ChatTestInner(): JSX.Element {
  const search = useSearchParams();
  const initialAgentId = search.get('agentId') ?? '';
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [agentId, setAgentId] = React.useState<string>(initialAgentId);
  const [message, setMessage] = React.useState('');
  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [lastLatency, setLastLatency] = React.useState<number | null>(null);
  const [lastTokens, setLastTokens] = React.useState<number | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const res = await apiFetch<{ items: Agent[] }>('/api/v1/agents');
        setAgents(res.items);
        if (agentId === '' && res.items.length > 0) {
          const first = res.items[0];
          if (first !== undefined) setAgentId(first.id);
        }
      } catch (err) {
        window.alert((err as Error).message);
      }
    })();
  }, [agentId]);

  React.useEffect(() => {
    if (scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  const send = async (): Promise<void> => {
    if (agentId === '' || message.trim().length === 0) return;
    const userMsg = message.trim();
    setMessage('');
    setBusy(true);
    setTurns((prev) => [
      ...prev,
      { id: crypto.randomUUID(), direction: 'INBOUND', content: userMsg, citations: [] },
    ]);
    try {
      const res = await apiFetch<ChatResult>('/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ agentId, message: userMsg, channel: 'WIDGET' }),
      });
      setLastLatency(res.latencyMs);
      setLastTokens(res.tokensUsed);
      setTurns((prev) => [
        ...prev,
        {
          id: res.outbound.id,
          direction: 'OUTBOUND',
          content: res.outbound.content,
          citations: res.outbound.citations,
          latencyMs: res.latencyMs,
        },
      ]);
    } catch (err) {
      window.alert((err as Error).message);
      setTurns((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          direction: 'OUTBOUND',
          content: `Error: ${(err as Error).message}`,
          citations: [],
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthGate>
      <main className="mx-auto flex h-screen max-w-4xl flex-col gap-4 p-6">
        <header className="flex items-center justify-between border-b border-cyan-ai/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-warm shadow-glow" />
              <span className="text-xs uppercase tracking-widest text-warm">Chat test</span>
            </div>
            <h1 className="mt-1 bg-aurora-gradient bg-clip-text text-2xl font-bold text-transparent">
              Probar agente
            </h1>
            <p className="text-xs text-cloud-300">
              {lastLatency !== null ? `latencia: ${lastLatency}ms` : '—'}
              {lastTokens !== null ? ` · tokens: ${lastTokens}` : ''}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-md border border-cloud-700/40 bg-midnight-700/30 px-3 py-1.5 text-xs text-cloud-200 hover:border-cyan-ai/60 hover:text-cyan-ai"
          >
            ← Dashboard
          </Link>
        </header>

        <div className="flex items-center gap-2">
          <label className="text-xs text-cloud-300">Agent:</label>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="input-midnight text-sm"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.key})
              </option>
            ))}
            {agents.length === 0 && <option value="">(sin agents — crea uno primero)</option>}
          </select>
        </div>

        <div
          ref={scrollRef}
          className="midnight-card flex-1 overflow-y-auto p-4"
          style={{ minHeight: 0 }}
        >
          {turns.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-cloud-400">
              Selecciona un agent y escribe tu primer mensaje.
            </div>
          )}
          <ul className="flex flex-col gap-3">
            {turns.map((t) => (
              <li
                key={t.id}
                className={`flex ${t.direction === 'INBOUND' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl border px-3 py-2 ${
                    t.direction === 'INBOUND'
                      ? 'border-electric-500/40 bg-electric-500/10 text-cloud'
                      : 'border-cyan-ai/40 bg-cyan-ai/10 text-cloud'
                  }`}
                >
                  <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                    <span
                      className={
                        t.direction === 'INBOUND' ? 'text-electric-300' : 'text-cyan-ai'
                      }
                    >
                      {t.direction === 'INBOUND' ? 'tú' : 'agent'}
                    </span>
                    {t.latencyMs !== undefined && (
                      <span className="text-cloud-400">{t.latencyMs}ms</span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{t.content}</div>
                  {t.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.citations.map((c) => (
                        <span
                          key={`${c.documentId}-${c.position}`}
                          className="chip chip-electric font-mono"
                        >
                          doc {c.documentId.slice(0, 8)} pos {c.position}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex gap-2"
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy || agentId === ''}
            className="input-midnight text-sm"
            placeholder="Escribe tu mensaje…"
          />
          <button
            type="submit"
            disabled={busy || message.trim().length === 0 || agentId === ''}
            className="btn-electric disabled:opacity-40"
          >
            {busy ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      </main>
    </AuthGate>
  );
}
