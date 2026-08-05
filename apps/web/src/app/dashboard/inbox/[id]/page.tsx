'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getTenant } from '../../../../lib/api-client';
import type { Conversation, Message } from '../../../../lib/agent-types';

const STATE_CHIP: Record<Conversation['state'], string> = {
  NEW: 'chip chip-electric',
  AI_ACTIVE: 'chip chip-cyan',
  WAITING_CUSTOMER: 'chip chip-electric',
  HUMAN_REQUIRED: 'chip chip-warm',
  ASSIGNED: 'chip chip-cyan',
  FOLLOW_UP: 'chip chip-electric',
  RESOLVED: 'chip chip-cloud',
  CLOSED: 'chip chip-cloud',
};

const STATE_LABEL: Record<Conversation['state'], string> = {
  NEW: 'nueva',
  AI_ACTIVE: 'AI activo',
  WAITING_CUSTOMER: 'esperando cliente',
  HUMAN_REQUIRED: 'requiere humano',
  ASSIGNED: 'asignada',
  FOLLOW_UP: 'seguimiento',
  RESOLVED: 'resuelta',
  CLOSED: 'cerrada',
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

export default function ConversationDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [conv, setConv] = React.useState<Conversation | null>(null);
  const [msgs, setMsgs] = React.useState<Message[]>([]);
  const [reply, setReply] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const c = await apiFetch<Conversation>(`/api/v1/conversations/${id}`);
      const m = await apiFetch<{ items: Message[] }>(`/api/v1/conversations/${id}/messages`);
      setConv(c);
      setMsgs(m.items);
    } catch (err) {
      window.alert((err as Error).message);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 8_000);
    return () => window.clearInterval(t);
  }, [load]);

  const onSend = async (): Promise<void> => {
    if (reply.trim().length === 0 || busy) return;
    setBusy(true);
    try {
      const r = await apiFetch<{ conversation: Conversation; message: Message }>(
        `/api/v1/conversations/${id}/reply`,
        { method: 'POST', body: JSON.stringify({ content: reply }) },
      );
      setReply('');
      setConv(r.conversation);
      setMsgs((prev) => [...prev, r.message]);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onClose = async (): Promise<void> => {
    if (!window.confirm('¿Cerrar esta conversación?')) return;
    try {
      const c = await apiFetch<Conversation>(`/api/v1/conversations/${id}/close`, { method: 'POST' });
      setConv(c);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  if (conv === null) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-6">
        <span className="text-sm text-cloud-300">Cargando conversación…</span>
      </main>
    );
  }

  const closed = conv.state === 'CLOSED' || conv.state === 'RESOLVED';

  return (
    <AuthGate>
      <main className="mx-auto flex h-screen max-w-4xl flex-col gap-4 p-6">
        <header className="flex items-center justify-between border-b border-cyan-ai/20 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-ai shadow-glow" />
              <span className="text-xs uppercase tracking-widest text-cyan-ai">Conversación</span>
            </div>
            <h1 className="mt-1 bg-aurora-gradient bg-clip-text text-xl font-bold text-transparent">
              {conv.customerDisplayName ?? conv.customerExternalId ?? 'Anónimo'}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-cloud-300">
              <span className={STATE_CHIP[conv.state]}>{STATE_LABEL[conv.state]}</span>
              <span className="font-mono text-cyan-ai">{conv.id.slice(0, 8)}…</span>
              <span>· {conv.messageCount} mensajes</span>
            </div>
          </div>
          <div className="flex gap-2">
            {!closed && (
              <button
                type="button"
                onClick={() => void onClose()}
                className="rounded-md border border-warm/40 bg-warm/10 px-3 py-1.5 text-xs text-warm hover:bg-warm/20"
              >
                Cerrar conversación
              </button>
            )}
            <Link
              href="/dashboard/inbox"
              className="rounded-md border border-cloud-700/40 bg-midnight-700/30 px-3 py-1.5 text-xs text-cloud-200 hover:border-cyan-ai/60 hover:text-cyan-ai"
            >
              ← Inbox
            </Link>
          </div>
        </header>

        <div className="midnight-card flex-1 overflow-y-auto p-3" style={{ minHeight: 0 }}>
          <ul className="flex flex-col gap-2">
            {msgs.map((m) => (
              <li
                key={m.id}
                className={`flex ${m.direction === 'INBOUND' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl border px-3 py-2 ${
                    m.direction === 'INBOUND'
                      ? 'border-electric-500/40 bg-electric-500/10 text-cloud'
                      : 'border-cyan-ai/40 bg-cyan-ai/10 text-cloud'
                  }`}
                >
                  <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                    <span className={m.direction === 'INBOUND' ? 'text-electric-300' : 'text-cyan-ai'}>
                      {m.role.toLowerCase()} · {m.direction === 'INBOUND' ? 'cliente' : 'agent'}
                    </span>
                    <span className="text-cloud-400">{new Date(m.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                  {m.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.citations.map((c) => (
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
            {msgs.length === 0 && (
              <li className="p-4 text-center text-sm text-cloud-400">No hay mensajes aún.</li>
            )}
          </ul>
        </div>

        {closed ? (
          <div className="rounded-md border border-cloud-700/30 bg-midnight-700/30 p-3 text-center text-xs text-cloud-400">
            Conversación {STATE_LABEL[conv.state]} · no se puede responder.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSend();
            }}
            className="flex gap-2"
          >
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              disabled={busy}
              className="input-midnight text-sm"
              placeholder="Escribe tu respuesta como humano…"
            />
            <button
              type="submit"
              disabled={busy || reply.trim().length === 0}
              className="btn-warm text-sm disabled:opacity-40"
            >
              {busy ? 'Enviando…' : 'Responder'}
            </button>
          </form>
        )}
      </main>
    </AuthGate>
  );
}
