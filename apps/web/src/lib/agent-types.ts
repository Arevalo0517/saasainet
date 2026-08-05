export type Agent = {
  id: string;
  clientId: string;
  key: string;
  name: string;
  description: string | null;
  defaultLocale: string;
  defaultTimezone: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentVersion = {
  id: string;
  agentId: string;
  version: number;
  state: 'DRAFT' | 'TESTING' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  name: string;
  description: string | null;
  language: string;
  timezone: string;
  objective: string | null;
  personality: string | null;
  tone: string | null;
  systemPrompt: string;
  welcomeMessage: string | null;
  outOfHoursMessage: string | null;
  allowedRules: string[];
  forbiddenRules: string[];
  dataToRequest: string[];
  sensitiveDataForbidden: string[];
  modelProfile: string;
  modelParameters: Record<string, unknown>;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeBase = {
  id: string;
  clientId: string;
  agentId: string | null;
  name: string;
  description: string | null;
  embeddingModel: string;
  embeddingDimensions: number;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Document = {
  id: string;
  knowledgeBaseId: string;
  clientId: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED';
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Conversation = {
  id: string;
  clientId: string;
  agentId: string;
  agentVersionId: string | null;
  channel: string;
  state: 'NEW' | 'AI_ACTIVE' | 'WAITING_CUSTOMER' | 'HUMAN_REQUIRED' | 'ASSIGNED' | 'FOLLOW_UP' | 'RESOLVED' | 'CLOSED';
  customerDisplayName: string | null;
  customerExternalId: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
  closedAt: string | null;
};

export type Message = {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  tokenCount: number;
  citations: Array<{ documentId: string; chunkId: string; position: number }>;
  createdAt: string;
};

export type ChatResult = {
  conversation: Conversation;
  inbound: Message;
  outbound: Message;
  tokensUsed: number;
  latencyMs: number;
};
