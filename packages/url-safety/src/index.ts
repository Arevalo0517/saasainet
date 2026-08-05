export type LookupResolver = (hostname: string) => Promise<readonly string[]>;

export interface ResolveAndCheckOptions {
  readonly allowlist?: readonly string[];
  readonly allowPrivateNetwork?: boolean;
  readonly resolver?: LookupResolver;
  readonly requireHttps?: boolean;
}

export type CheckResult =
  | { readonly ok: true; readonly ips: readonly string[]; readonly matchedRule?: string }
  | {
      readonly ok: false;
      readonly code:
        | 'URL_INVALID'
        | 'URL_INVALID_SCHEME'
        | 'URL_HOST_BLOCKED'
        | 'URL_PRIVATE_IP'
        | 'URL_NOT_HTTPS'
        | 'URL_NOT_IN_ALLOWLIST'
        | 'DNS_LOOKUP_FAILED';
      readonly message: string;
    };

const isPrivateIPv4 = (ip: string): boolean => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (m === null) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  if (a >= 224) return true;
  return false;
};

const isPrivateIPv6 = (ip: string): boolean => {
  const lc = ip.toLowerCase().split('%')[0] ?? ip;
  if (lc === '::1') return true;
  if (lc === '::' || lc === '0:0:0:0:0:0:0:0') return true;
  if (lc.startsWith('fc') || lc.startsWith('fd')) return true;
  if (lc.startsWith('fe80')) return true;
  if (lc.startsWith('ff')) return true;
  if (lc.startsWith('::ffff:')) {
    const v4Part = lc.slice(7);
    return isPrivateIPv4(v4Part);
  }
  return false;
};

export const isPrivateIP = (ip: string): boolean => {
  if (ip.includes(':')) return isPrivateIPv6(ip);
  return isPrivateIPv4(ip);
};

const matchesAllowlist = (host: string, allowlist: readonly string[]): string | undefined => {
  for (const rule of allowlist) {
    if (rule.startsWith('*.')) {
      const ruleHost = rule.slice(2);
      if (host !== ruleHost && host.endsWith(`.${ruleHost}`)) return rule;
    } else if (host === rule) {
      return rule;
    }
  }
  return undefined;
};

const defaultResolver: LookupResolver = async (hostname: string): Promise<readonly string[]> => {
  const { promises: dnsPromises } = await import('node:dns');
  const addrs = await dnsPromises.lookup(hostname, { all: true, verbatim: true });
  return addrs.map((a) => a.address);
};

export const resolveAndCheck = async (
  url: string,
  options: ResolveAndCheckOptions = {},
): Promise<CheckResult> => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, code: 'URL_INVALID', message: `URL inválida: ${url}` };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      ok: false,
      code: 'URL_INVALID_SCHEME',
      message: `Solo http/https permitido (recibido ${parsed.protocol})`,
    };
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === 'metadata.google.internal' || host === 'metadata') {
    return { ok: false, code: 'URL_HOST_BLOCKED', message: `Host bloqueado por seguridad: ${host}` };
  }
  if (isPrivateIP(host)) {
    return { ok: false, code: 'URL_HOST_BLOCKED', message: `IP bloqueada por seguridad: ${host}` };
  }
  if (options.allowlist !== undefined && options.allowlist.length > 0) {
    const matched = matchesAllowlist(host, options.allowlist);
    if (matched === undefined) {
      return {
        ok: false,
        code: 'URL_NOT_IN_ALLOWLIST',
        message: `Host "${host}" no está en la allowlist`,
      };
    }
    if (!options.allowPrivateNetwork) {
      const resolver = options.resolver ?? defaultResolver;
      let ips: readonly string[];
      try {
        ips = await resolver(host);
      } catch (err) {
        return {
          ok: false,
          code: 'DNS_LOOKUP_FAILED',
          message: `No se pudo resolver ${host}: ${(err as Error).message}`,
        };
      }
      if (ips.length === 0) {
        return { ok: false, code: 'DNS_LOOKUP_FAILED', message: `Sin registros para ${host}` };
      }
      for (const ip of ips) {
        if (isPrivateIP(ip)) {
          return {
            ok: false,
            code: 'URL_PRIVATE_IP',
            message: `Host ${host} resuelve a IP privada: ${ip}`,
          };
        }
      }
      return { ok: true, ips, matchedRule: matched };
    }
    return { ok: true, ips: [], matchedRule: matched };
  }
  if (options.requireHttps === true && parsed.protocol !== 'https:') {
    return { ok: false, code: 'URL_NOT_HTTPS', message: 'Se requiere https' };
  }
  if (!options.allowPrivateNetwork) {
    const resolver = options.resolver ?? defaultResolver;
    let ips: readonly string[];
    try {
      ips = await resolver(host);
    } catch (err) {
      return {
        ok: false,
        code: 'DNS_LOOKUP_FAILED',
        message: `No se pudo resolver ${host}: ${(err as Error).message}`,
      };
    }
    if (ips.length === 0) {
      return { ok: false, code: 'DNS_LOOKUP_FAILED', message: `Sin registros para ${host}` };
    }
    for (const ip of ips) {
      if (isPrivateIP(ip)) {
        return {
          ok: false,
          code: 'URL_PRIVATE_IP',
          message: `Host ${host} resuelve a IP privada: ${ip}`,
        };
      }
    }
    return { ok: true, ips };
  }
  return { ok: true, ips: [] };
};
