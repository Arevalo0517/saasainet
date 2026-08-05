const REDACT_KEYS = new Set([
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'access_token',
  'refresh_token',
  'authorization',
  'authorization_header',
  'private_key',
  'client_secret',
  'webhook_secret',
  'upstash_token',
  'supabase_service_role_key',
]);

export const redactObject = <T>(value: T, depth = 0): T => {
  if (depth > 6) return value;
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item, depth + 1)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.has(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactObject(val, depth + 1);
    }
  }
  return result as T;
};

export const redactSensitiveHeaders = (headers: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = value;
    }
  }
  return out;
};
