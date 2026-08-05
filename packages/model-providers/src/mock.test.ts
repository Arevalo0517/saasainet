import { describe, it, expect } from 'vitest';
import { MockModelProvider } from './mock.js';

describe('MockModelProvider', () => {
  const provider = new MockModelProvider();

  it('resolveModel parses openai: prefix', async () => {
    const r = await provider.resolveModel({ modelProfile: 'openai:gpt-4o-mini' });
    expect(r.provider).toBe('openai');
    expect(r.model).toBe('gpt-4o-mini');
    expect(r.maxTokens).toBe(4096);
  });

  it('resolveModel parses mock: prefix', async () => {
    const r = await provider.resolveModel({ modelProfile: 'mock:foo' });
    expect(r.provider).toBe('mock');
  });

  it('resolveModel returns default for unknown prefix', async () => {
    const r = await provider.resolveModel({ modelProfile: 'gpt-x' });
    expect(r.provider).toBe('mock');
  });

  it('generateEmbedding returns vector of configured dimensions', async () => {
    const r = await provider.generateEmbedding({ text: '¿Cuál es el horario?' });
    expect(r.dimensions).toBe(1536);
    expect(r.embedding.length).toBe(1536);
  });

  it('generateEmbedding returns normalized vector (unit norm)', async () => {
    const r = await provider.generateEmbedding({ text: 'horario atención lunes' });
    let norm = 0;
    for (const v of r.embedding) norm += v * v;
    expect(Math.sqrt(norm)).toBeCloseTo(1, 5);
  });

  it('generateEmbedding is deterministic for same input', async () => {
    const a = await provider.generateEmbedding({ text: 'mismo texto' });
    const b = await provider.generateEmbedding({ text: 'mismo texto' });
    expect(a.embedding).toEqual(b.embedding);
  });

  it('generateEmbedding differs for different inputs', async () => {
    const a = await provider.generateEmbedding({ text: 'horario' });
    const b = await provider.generateEmbedding({ text: 'cancelar orden' });
    let diff = 0;
    for (let i = 0; i < a.embedding.length; i++) {
      if (Math.abs((a.embedding[i] ?? 0) - (b.embedding[i] ?? 0)) > 1e-9) diff++;
    }
    expect(diff).toBeGreaterThan(2);
  });

  it('generateEmbedding returns zero vector for stopwords-only text', async () => {
    const r = await provider.generateEmbedding({ text: 'a el la de' });
    expect(r.embedding.every((v) => v === 0)).toBe(true);
  });

  it('summarizeConversation returns non-empty summary', async () => {
    const r = await provider.summarizeConversation({
      conversationId: 'c1',
      messages: [{ role: 'user', content: '¿Cuál es el horario?' }],
    });
    expect(r.summary.length).toBeGreaterThan(0);
    expect(r.tokensUsed).toBeGreaterThan(0);
  });
});
