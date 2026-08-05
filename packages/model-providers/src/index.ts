export interface ResolveModelInput {
  modelProfile: string;
  parameters?: Record<string, unknown>;
}

export interface ResolvedModel {
  provider: string;
  model: string;
  maxTokens: number;
  temperature?: number;
  topP?: number;
}

export interface ModelProvider {
  resolveModel(input: ResolveModelInput): Promise<ResolvedModel>;
  summarizeConversation(input: SummarizeConversationInput): Promise<SummarizeConversationResult>;
}

export interface SummarizeConversationInput {
  conversationId: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  maxOutputTokens?: number;
}

export interface SummarizeConversationResult {
  summary: string;
  tokensUsed: number;
}

export interface GenerateEmbeddingInput {
  text: string;
  modelProfile?: string;
}

export interface GenerateEmbeddingResult {
  embedding: number[];
  dimensions: number;
  modelProfile: string;
}

export interface EmbeddingProvider {
  generateEmbedding(input: GenerateEmbeddingInput): Promise<GenerateEmbeddingResult>;
}

export { OpenAIModelProvider, type OpenAIModelProviderOptions } from './openai.js';
export { MockModelProvider } from './mock.js';
