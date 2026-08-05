import { PLACEHOLDER, type WidgetConfig } from './index.js';

export interface WidgetChatMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  citations?: Array<{ documentId: string; chunkId: string; position: number }>;
  latencyMs?: number;
  createdAt: string;
}

export interface WidgetInitOptions {
  apiUrl?: string;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  title?: string;
  customerDisplayName?: string;
  welcomeMessage?: string;
  container?: HTMLElement | string;
}

export interface WidgetHandle {
  open: () => void;
  close: () => void;
  toggle: () => void;
  destroy: () => void;
  setMessages: (messages: WidgetChatMessage[]) => void;
  setHistory: (config: { conversationExternalId: string; messages: WidgetChatMessage[] }) => void;
}

const WIDGET_VERSION = '0.1.0';
const STORAGE_KEY_PREFIX = 'platform.widget.';

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

const generateExternalId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `ext_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const fetchConfig = async (apiUrl: string, publicWidgetId: string): Promise<WidgetConfig> => {
  const res = await fetch(`${apiUrl}/api/v1/widget/${publicWidgetId}/config`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as WidgetConfig;
};

const sendChat = async (
  apiUrl: string,
  publicWidgetId: string,
  body: { conversationExternalId: string; message: string; customerDisplayName?: string },
): Promise<{ conversationExternalId: string; inbound: WidgetChatMessage; outbound: WidgetChatMessage; tokensUsed: number; latencyMs: number }> => {
  const res = await fetch(`${apiUrl}/api/v1/widget/${publicWidgetId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { conversationExternalId: string; inbound: WidgetChatMessage; outbound: WidgetChatMessage; tokensUsed: number; latencyMs: number };
};

const el = (tag: string, attrs: Record<string, string> = {}, ...children: (string | Node)[]): HTMLElement => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.setAttribute('style', v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const buildWidget = (config: WidgetConfig, opts: WidgetInitOptions, apiUrl: string): { mount: (target: HTMLElement) => WidgetHandle } => {
  const primary: string = opts.primaryColor ?? config.primaryColor ?? '#22D3EE';
  const position: 'bottom-right' | 'bottom-left' = opts.position ?? config.position ?? 'bottom-right';
  const title: string = opts.title ?? config.title ?? 'Chat';
  const welcome: string = opts.welcomeMessage ?? config.welcomeMessage ?? 'Hola, ¿en qué te ayudo?';
  const storageKey = `${STORAGE_KEY_PREFIX}${config.publicWidgetId}`;

  const styles = `
    .pw-root { position: fixed; ${position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'} bottom: 20px; z-index: 2147483000; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .pw-bubble { width: 60px; height: 60px; border-radius: 50%; background: ${primary}; border: none; cursor: pointer; box-shadow: 0 8px 24px -8px ${primary}aa; color: #07111f; font-size: 28px; display: flex; align-items: center; justify-content: center; transition: transform 120ms ease; }
    .pw-bubble:hover { transform: scale(1.06); }
    .pw-panel { width: 360px; max-width: calc(100vw - 40px); height: 520px; max-height: calc(100vh - 100px); background: #07111f; border: 1px solid ${primary}55; border-radius: 16px; display: none; flex-direction: column; overflow: hidden; box-shadow: 0 16px 48px -16px rgba(0,0,0,0.6); }
    .pw-panel.pw-open { display: flex; }
    .pw-header { background: linear-gradient(135deg, #2563eb 0%, ${primary} 100%); padding: 12px 16px; color: #f8fafc; font-weight: 600; display: flex; align-items: center; justify-content: space-between; }
    .pw-header-meta { font-size: 10px; opacity: 0.8; }
    .pw-close { background: none; border: none; color: #f8fafc; font-size: 20px; cursor: pointer; }
    .pw-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .pw-msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; }
    .pw-msg-in { align-self: flex-end; background: #2563eb22; border: 1px solid #2563eb55; color: #f8fafc; }
    .pw-msg-out { align-self: flex-start; background: ${primary}22; border: 1px solid ${primary}55; color: #f8fafc; }
    .pw-msg-meta { font-size: 9px; opacity: 0.6; margin-top: 4px; }
    .pw-citations { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; }
    .pw-citation { background: ${primary}15; color: ${primary}; font-size: 9px; padding: 2px 6px; border-radius: 9999px; border: 1px solid ${primary}44; }
    .pw-empty { margin: auto; color: #94a3b8; font-size: 12px; text-align: center; padding: 16px; }
    .pw-form { border-top: 1px solid ${primary}33; padding: 8px; display: flex; gap: 6px; }
    .pw-input { flex: 1; background: #0a0f1c; border: 1px solid ${primary}33; color: #f8fafc; padding: 8px 10px; border-radius: 8px; font-size: 13px; font-family: inherit; }
    .pw-input:focus { outline: none; border-color: ${primary}; box-shadow: 0 0 0 2px ${primary}33; }
    .pw-send { background: ${primary}; color: #07111f; border: none; padding: 0 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; }
    .pw-send:disabled { opacity: 0.4; cursor: not-allowed; }
  `;

  return {
    mount: (target: HTMLElement): WidgetHandle => {
      const root = el('div', { class: 'pw-root' });
      const style = el('style', { class: 'pw-style' });
      style.textContent = styles;
      const bubble = el('button', { class: 'pw-bubble', type: 'button', 'aria-label': 'Abrir chat' }, '💬');
      const panel = el('div', { class: 'pw-panel', role: 'dialog', 'aria-label': title });
      const header = el('div', { class: 'pw-header' });
      const titleWrap = el('div', {});
      titleWrap.appendChild(el('div', {}, title));
      titleWrap.appendChild(el('div', { class: 'pw-header-meta' }, `widget v${WIDGET_VERSION}`));
      const closeBtn = el('button', { class: 'pw-close', type: 'button', 'aria-label': 'Cerrar' }, '×');
      header.appendChild(titleWrap);
      header.appendChild(closeBtn);

      const messages = el('div', { class: 'pw-messages' });
      const empty = el('div', { class: 'pw-empty' }, welcome);
      messages.appendChild(empty);

      const form = el('form', { class: 'pw-form' });
      const input = el('textarea', {
        class: 'pw-input',
        rows: '1',
        placeholder: 'Escribe tu mensaje…',
        'aria-label': 'Mensaje',
      }) as HTMLTextAreaElement;
      const sendBtn = el('button', { class: 'pw-send', type: 'submit' }, 'Enviar') as HTMLButtonElement;
      form.appendChild(input);
      form.appendChild(sendBtn);

      panel.appendChild(header);
      panel.appendChild(messages);
      panel.appendChild(form);
      root.appendChild(bubble);
      root.appendChild(panel);
      target.appendChild(style);
      target.appendChild(root);

      let conversationExternalId = (() => {
        try {
          return window.localStorage.getItem(storageKey) ?? generateExternalId();
        } catch {
          return generateExternalId();
        }
      })();
      try {
        window.localStorage.setItem(storageKey, conversationExternalId);
      } catch {
        // ignore
      }

      let busy = false;

      const renderMessage = (m: WidgetChatMessage): void => {
        if (empty.parentElement === messages) messages.removeChild(empty);
        const wrap = el('div', { class: `pw-msg pw-msg-${m.direction === 'INBOUND' ? 'in' : 'out'}` });
        const text = el('div', {});
        text.innerHTML = escapeHtml(m.content).replace(/\n/g, '<br>');
        wrap.appendChild(text);
        if (m.citations !== undefined && m.citations.length > 0) {
          const cits = el('div', { class: 'pw-citations' });
          for (const c of m.citations.slice(0, 3)) {
            const label = `doc ${c.documentId.slice(0, 8)} · pos ${c.position}`;
            cits.appendChild(el('span', { class: 'pw-citation' }, label));
          }
          wrap.appendChild(cits);
        }
        if (m.latencyMs !== undefined) {
          wrap.appendChild(el('div', { class: 'pw-msg-meta' }, `${m.latencyMs}ms`));
        }
        messages.appendChild(wrap);
        messages.scrollTop = messages.scrollHeight;
      };

      const open = (): void => {
        panel.classList.add('pw-open');
        bubble.style.display = 'none';
        input.focus();
      };
      const close = (): void => {
        panel.classList.remove('pw-open');
        bubble.style.display = 'flex';
      };
      const toggle = (): void => {
        if (panel.classList.contains('pw-open')) close();
        else open();
      };
      const destroy = (): void => {
        if (root.parentElement !== null) root.parentElement.removeChild(root);
        if (style.parentElement !== null) style.parentElement.removeChild(style);
      };

      bubble.addEventListener('click', toggle);
      closeBtn.addEventListener('click', close);

      const submit = async (e: Event): Promise<void> => {
        e.preventDefault();
        const text = input.value.trim();
        if (text.length === 0 || busy) return;
        busy = true;
        sendBtn.disabled = true;
        renderMessage({
          id: `local-${Date.now()}`,
          direction: 'INBOUND',
          content: text,
          createdAt: new Date().toISOString(),
        });
        input.value = '';
        try {
          const res = await sendChat(apiUrl, config.publicWidgetId, {
            conversationExternalId,
            message: text,
            customerDisplayName: opts.customerDisplayName,
          });
          renderMessage({ ...res.outbound, direction: 'OUTBOUND' });
        } catch (err) {
          renderMessage({
            id: `err-${Date.now()}`,
            direction: 'OUTBOUND',
            content: `Error: ${(err as Error).message}`,
            createdAt: new Date().toISOString(),
          });
        } finally {
          busy = false;
          sendBtn.disabled = false;
          input.focus();
        }
      };
      form.addEventListener('submit', submit);
      input.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' && !(e as KeyboardEvent).shiftKey) {
          e.preventDefault();
          void submit(e);
        }
      });

      return {
        open,
        close,
        toggle,
        destroy,
        setMessages: (msgs: WidgetChatMessage[]): void => {
          while (messages.firstChild !== null) messages.removeChild(messages.firstChild);
          if (msgs.length === 0) messages.appendChild(empty);
          for (const m of msgs) renderMessage(m);
        },
        setHistory: (h: { conversationExternalId: string; messages: WidgetChatMessage[] }): void => {
          conversationExternalId = h.conversationExternalId;
          try {
            window.localStorage.setItem(storageKey, h.conversationExternalId);
          } catch {
            // ignore
          }
          while (messages.firstChild !== null) messages.removeChild(messages.firstChild);
          if (h.messages.length === 0) messages.appendChild(empty);
          for (const m of h.messages) renderMessage(m);
        },
      };
    },
  };
};

export const initWidget = async (
  publicWidgetId: string,
  options: WidgetInitOptions = {},
): Promise<WidgetHandle> => {
  if (!isBrowser()) {
    throw new Error('Widget solo puede inicializarse en el navegador');
  }
  const apiUrl = (options.apiUrl ?? '').replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
  const config = await fetchConfig(apiUrl, publicWidgetId);
  const target =
    typeof options.container === 'string'
      ? document.querySelector(options.container)
      : options.container ?? document.body;
  if (target === null) {
    throw new Error(`No se encontró el contenedor para el widget (${String(options.container ?? 'body')})`);
  }
  return buildWidget(config, options, apiUrl).mount(target as HTMLElement);
};

declare global {
  interface Window {
    PlatformWidget?: {
      init: typeof initWidget;
      version: string;
      placeholder: string;
    };
  }
}

if (isBrowser()) {
  window.PlatformWidget = {
    init: initWidget,
    version: WIDGET_VERSION,
    placeholder: PLACEHOLDER,
  };
}
