import OpenAI from 'openai';
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

export interface OpenAIModelProviderOptions {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  defaultChatModel?: string;
  defaultEmbeddingModel?: string;
}

export class OpenAIModelProvider implements ModelProvider, EmbeddingProvider {
  private readonly client: OpenAI;
  private readonly defaultChatModel: string;
  private readonly defaultEmbeddingModel: string;

  constructor(opts: OpenAIModelProviderOptions) {
    if (opts.apiKey.length === 0) throw new Error('OpenAIModelProvider: apiKey is required');
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      organization: opts.organization,
      baseURL: opts.baseURL,
    });
    this.defaultChatModel = opts.defaultChatModel ?? 'gpt-4o-mini';
    this.defaultEmbeddingModel = opts.defaultEmbeddingModel ?? 'text-embedding-3-small';
  }

  async resolveModel(input: ResolveModelInput): Promise<ResolvedModel> {
    const raw = input.modelProfile;
    if (raw.startsWith('openai:')) {
      const model = raw.slice('openai:'.length);
      return { provider: 'openai', model, maxTokens: 4096, temperature: 0.3 };
    }
    return { provider: 'openai', model: this.defaultChatModel, maxTokens: 4096, temperature: 0.3 };
  }

  async summarizeConversation(input: SummarizeConversationInput): Promise<SummarizeConversationResult> {
    const completion = await this.client.chat.completions.create({
      model: this.defaultChatModel,
      max_tokens: input.maxOutputTokens ?? 256,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente que resume conversaciones de soporte de forma concisa y en español. ' +
            'Devuelve solo el resumen, sin introducciones.',
        },
        ...input.messages,
      ],
    });
    const summary = completion.choices[0]?.message?.content ?? '';
    const tokensUsed = completion.usage?.total_tokens ?? 0;
    return { summary, tokensUsed };
  }

  async generateEmbedding(input: GenerateEmbeddingInput): Promise<GenerateEmbeddingResult> {
    const model = input.modelProfile ?? this.defaultEmbeddingModel;
    const res = await this.client.embeddings.create({ model, input: input.text });
    const embedding = res.data[0]?.embedding ?? [];
    return { embedding, dimensions: embedding.length, modelProfile: model };
  }
}
