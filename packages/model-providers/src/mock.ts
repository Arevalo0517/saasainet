import type {
  EmbeddingProvider,
  GenerateEmbeddingInput,
  GenerateEmbeddingResult,
  ModelProvider,
  ResolveModelInput,
  ResolvedModel,
  SummarizeConversationInput,
  SummarizeConversationResult,
} from './index.js';

const STOPWORDS = new Set([
  'a', 'al', 'algo', 'algunas', 'algunos', 'ante', 'antes', 'como', 'con', 'contra', 'cual', 'cuando', 'de',
  'del', 'desde', 'donde', 'durante', 'e', 'el', 'ella', 'ellas', 'ellos', 'en', 'entre', 'era', 'erais',
  'eran', 'eras', 'eres', 'es', 'esa', 'esas', 'ese', 'eso', 'esos', 'esta', 'estaba', 'estabais', 'estaban',
  'estabas', 'estad', 'estada', 'estadas', 'estado', 'estados', 'estais', 'estamos', 'estan', 'estar', 'estará',
  'estarán', 'estarás', 'estaré', 'estaréis', 'estaríamos', 'estarían', 'estarías', 'estas', 'este', 'esto',
  'estos', 'estoy', 'etc', 'fue', 'fuera', 'fuerais', 'fueran', 'fueras', 'fueron', 'fui', 'fuimos', 'ha', 'habida',
  'habidas', 'habido', 'habidos', 'habiendo', 'habrá', 'habrán', 'había', 'habíamos', 'han', 'has', 'hasta',
  'hay', 'haya', 'hayamos', 'hayan', 'hayas', 'hayáis', 'he', 'hemos', 'hube', 'hubiera', 'hubierais', 'hubieran',
  'hubieras', 'hubieron', 'hubimos', 'hubiste', 'hubisteis', 'hubo', 'la', 'las', 'le', 'les', 'lo', 'los', 'más',
  'me', 'mi', 'mis', 'mucho', 'muchos', 'muy', 'nada', 'ni', 'no', 'nos', 'nosotras', 'nosotros', 'nuestra',
  'nuestras', 'nuestro', 'nuestros', 'o', 'os', 'otra', 'otras', 'otro', 'otros', 'para', 'pero', 'poco', 'por',
  'porque', 'que', 'quien', 'quienes', 'se', 'sea', 'seamos', 'sean', 'seas', 'ser', 'sería', 'si', 'sido',
  'siendo', 'sin', 'sobre', 'sois', 'somos', 'son', 'soy', 'su', 'sus', 'también', 'tanto', 'te', 'tendrá',
  'tendrán', 'tendrás', 'tendré', 'tendríamos', 'tendrían', 'tenemos', 'tener', 'tengo', 'ti', 'tiene', 'tienen',
  'tienes', 'todo', 'todos', 'tu', 'tus', 'tuya', 'tuyas', 'tuyo', 'tuyos', 'un', 'una', 'uno', 'unos', 'vosotras',
  'vosotros', 'vuestra', 'vuestras', 'vuestro', 'vuestros', 'y', 'ya', 'yo',
]);

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
};

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
};

export class MockModelProvider implements ModelProvider, EmbeddingProvider {
  private readonly dimensions: number;
  private readonly defaultEmbeddingModel: string;

  constructor(opts: { dimensions?: number; embeddingModel?: string } = {}) {
    this.dimensions = opts.dimensions ?? 1536;
    this.defaultEmbeddingModel = opts.embeddingModel ?? 'mock:text-embedding-1536';
  }

  async resolveModel(input: ResolveModelInput): Promise<ResolvedModel> {
    const raw = input.modelProfile;
    if (raw.startsWith('openai:') || raw.startsWith('mock:')) {
      const model = raw.includes(':') ? raw.split(':')[1] ?? 'gpt-4o-mini' : raw;
      return { provider: raw.startsWith('mock:') ? 'mock' : 'openai', model, maxTokens: 4096, temperature: 0.3 };
    }
    return { provider: 'mock', model: 'mock-chat-1', maxTokens: 4096, temperature: 0.3 };
  }

  async summarizeConversation(input: SummarizeConversationInput): Promise<SummarizeConversationResult> {
    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
    const summary = lastUser
      ? `Resumen mock: el usuario preguntó "${lastUser.content.slice(0, 80)}".`
      : 'Resumen mock: conversación sin contenido del usuario.';
    return { summary, tokensUsed: summary.length };
  }

  async generateEmbedding(input: GenerateEmbeddingInput): Promise<GenerateEmbeddingResult> {
    const tokens = tokenize(input.text);
    const vec = new Array<number>(this.dimensions).fill(0);
    if (tokens.length === 0) {
      return { embedding: vec, dimensions: this.dimensions, modelProfile: this.defaultEmbeddingModel };
    }
    for (const t of tokens) {
      const h = hash(t);
      const idx = h % this.dimensions;
      const sign = ((h >>> 16) & 1) === 0 ? 1 : -1;
      vec[idx] = vec[idx]! + sign * (1 / Math.sqrt(tokens.length));
    }
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < vec.length; i++) vec[i] = vec[i]! / norm;
    return { embedding: vec, dimensions: this.dimensions, modelProfile: this.defaultEmbeddingModel };
  }
}
