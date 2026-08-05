const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const MAX_HOSTNAME_LENGTH = 253;
export const MAX_HOSTS_PER_ALLOWLIST = 200;

export interface NormalizedHost {
  readonly input: string;
  readonly host: string;
  readonly wildcard: boolean;
}

export class HostnameValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HostnameValidationError';
  }
}

export const normalizeHostname = (raw: string): NormalizedHost | null => {
  if (typeof raw !== 'string') return null;
  let value = raw.trim().toLowerCase();
  if (value.length === 0) return null;
  value = value.replace(/^\.+/, '').replace(/\.+$/, '');
  if (value.length === 0) return null;
  let wildcard = false;
  if (value.startsWith('*.')) {
    wildcard = true;
    value = value.slice(2);
  }
  if (value.length === 0) return null;
  if (value.length > MAX_HOSTNAME_LENGTH) return null;
  if (value.includes('://') || value.includes('/') || value.includes('?') || value.includes('#')) return null;
  const colonIdx = value.lastIndexOf(':');
  if (colonIdx !== -1) {
    const port = value.slice(colonIdx + 1);
    if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) return null;
    value = value.slice(0, colonIdx);
  }
  const labels = value.split('.');
  if (labels.length === 0) return null;
  for (const label of labels) {
    if (label.length === 0 || label.length > 63) return null;
    if (!HOSTNAME_LABEL.test(label)) return null;
  }
  return { input: raw, host: value, wildcard };
};

export const normalizeHostList = (raw: readonly unknown[]): string[] => {
  if (raw.length > MAX_HOSTS_PER_ALLOWLIST) {
    throw new HostnameValidationError(
      'WEBHOOK_ALLOWLIST_TOO_LARGE',
      `[WEBHOOK_ALLOWLIST_TOO_LARGE] Máximo ${MAX_HOSTS_PER_ALLOWLIST} hosts permitidos`,
    );
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      throw new HostnameValidationError('WEBHOOK_ALLOWLIST_INVALID', '[WEBHOOK_ALLOWLIST_INVALID] Cada host debe ser string');
    }
    const n = normalizeHostname(entry);
    if (n === null) {
      throw new HostnameValidationError('WEBHOOK_ALLOWLIST_INVALID', `[WEBHOOK_ALLOWLIST_INVALID] Host inválido: ${entry}`);
    }
    const key = n.wildcard ? `*.${n.host}` : n.host;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
};

const isPrivateIPv4 = (ip: number[]): boolean => {
  if (ip.length !== 4) return false;
  const a = ip[0] ?? 0;
  const b = ip[1] ?? 0;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  if (a >= 224) return true;
  return false;
};

const isPrivateIPv6 = (s: string): boolean => {
  const lower = s.toLowerCase();
  if (lower === '::1') return true;
  if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe80')) return true;
  if (lower.startsWith('ff')) return true;
  return false;
};

export const isPrivateHostLiteral = (value: string): boolean => {
  if (value.includes(':')) return isPrivateIPv6(value);
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return isPrivateIPv4(value.split('.').map((n) => Number(n)));
  }
  return false;
};

const PRIVATE_HOST_LITERALS = new Set(['localhost', 'metadata.google.internal', 'metadata']);

export const isAlwaysBlockedLiteral = (value: string): boolean => {
  if (PRIVATE_HOST_LITERALS.has(value)) return true;
  return isPrivateHostLiteral(value);
};

export interface AllowlistCheckResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
  readonly matchedRule?: string;
}

export const checkUrlAgainstAllowlist = (
  url: string,
  allowlist: readonly string[],
): AllowlistCheckResult => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, code: 'WEBHOOK_URL_INVALID', message: `URL inválida: ${url}` };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      ok: false,
      code: 'WEBHOOK_URL_INVALID_SCHEME',
      message: `Solo http/https permitido (recibido ${parsed.protocol})`,
    };
  }
  const host = parsed.hostname.toLowerCase();
  if (isAlwaysBlockedLiteral(host)) {
    return { ok: false, code: 'WEBHOOK_URL_BLOCKED_HOST', message: `Host bloqueado por seguridad: ${host}` };
  }
  if (allowlist.length === 0) {
    if (parsed.protocol !== 'https:') {
      return {
        ok: false,
        code: 'WEBHOOK_URL_NOT_HTTPS',
        message: 'Sin allowlist configurada, solo se permite https://',
      };
    }
    return { ok: true };
  }
  for (const rule of allowlist) {
    if (rule.startsWith('*.')) {
      const ruleHost = rule.slice(2);
      if (host !== ruleHost && host.endsWith(`.${ruleHost}`)) {
        return { ok: true, matchedRule: rule };
      }
    } else if (host === rule) {
      return { ok: true, matchedRule: rule };
    }
  }
  return {
    ok: false,
    code: 'WEBHOOK_URL_NOT_IN_ALLOWLIST',
    message: `Host "${host}" no está en la allowlist del cliente`,
  };
};
