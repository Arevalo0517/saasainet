import { describe, it, expect } from 'vitest';
import { redactObject, redactSensitiveHeaders } from '../src/redaction.js';
import { newCorrelationId, extractCorrelationId } from '../src/correlation.js';

describe('redaction', () => {
  it('redacta secretos en objetos anidados', () => {
    const input = {
      user: 'david',
      apiKey: 'sk-secret',
      nested: {
        token: 'abc',
        visible: true,
      },
      list: [{ password: 'p1' }, { ok: true }],
    };
    const out = redactObject(input);
    expect(out).toMatchObject({
      user: 'david',
      apiKey: '[REDACTED]',
      nested: { token: '[REDACTED]', visible: true },
      list: [{ password: '[REDACTED]' }, { ok: true }],
    });
  });

  it('redacta headers sensibles case-insensitive', () => {
    const out = redactSensitiveHeaders({ Authorization: 'Bearer x', 'x-test': 'ok' });
    expect(out['Authorization']).toBe('[REDACTED]');
    expect(out['x-test']).toBe('ok');
  });
});

describe('correlation', () => {
  it('genera un UUID nuevo', () => {
    const id = newCorrelationId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('extrae correlation id de Headers', () => {
    const h = new Headers({ 'x-correlation-id': 'abc-123' });
    expect(extractCorrelationId(h)).toBe('abc-123');
  });

  it('genera uno nuevo si no hay header', () => {
    const id = extractCorrelationId({});
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
