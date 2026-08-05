import { Module } from '@nestjs/common';
import { DatabaseModule } from '../infrastructure/database/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { OpenAIModelProvider, MockModelProvider, type EmbeddingProvider, type ModelProvider } from '@platform/model-providers';
import { DATABASE } from '../infrastructure/database/database.module.js';
import type { Database as DbType } from '@platform/db';
import { DrizzleAgentRepository } from '../infrastructure/persistence/drizzle/agents.repository.js';
import {
  DrizzleChunkRepository,
  DrizzleDocumentRepository,
  DrizzleKnowledgeBaseRepository,
} from '../infrastructure/persistence/drizzle/knowledge.repository.js';
import {
  DrizzleConversationRepository,
  DrizzleMessageRepository,
} from '../infrastructure/persistence/drizzle/conversations.repository.js';
import { AgentsService } from './agents.service.js';
import { KnowledgeBasesService } from './knowledge-bases.service.js';
import { DocumentsService } from './documents.service.js';
import { ConversationsService } from './conversations.service.js';
import { WidgetService } from './widget.service.js';
import { AgentsController } from './agents.controller.js';
import { KnowledgeBasesController } from './knowledge-bases.controller.js';
import { DocumentsController } from './documents.controller.js';
import { ConversationsController, ChatController } from './conversations.controller.js';
import { WidgetController } from './widget.controller.js';
import { EMBEDDING_PROVIDER, MODEL_PROVIDER } from './agent.tokens.js';

export { EMBEDDING_PROVIDER, MODEL_PROVIDER };

const useMockProvider = (process.env.MODEL_PROVIDER ?? 'mock') === 'mock';

@Module({
  imports: [DatabaseModule, AuditModule, UsageModule, ChannelsModule],
  providers: [
    {
      provide: DrizzleAgentRepository,
      inject: [DATABASE],
      useFactory: (db: DbType) => new DrizzleAgentRepository(db),
    },
    {
      provide: DrizzleKnowledgeBaseRepository,
      inject: [DATABASE],
      useFactory: (db: DbType) => new DrizzleKnowledgeBaseRepository(db),
    },
    {
      provide: DrizzleDocumentRepository,
      inject: [DATABASE],
      useFactory: (db: DbType) => new DrizzleDocumentRepository(db),
    },
    {
      provide: DrizzleChunkRepository,
      inject: [DATABASE],
      useFactory: (db: DbType) => new DrizzleChunkRepository(db),
    },
    {
      provide: DrizzleConversationRepository,
      inject: [DATABASE],
      useFactory: (db: DbType) => new DrizzleConversationRepository(db),
    },
    {
      provide: DrizzleMessageRepository,
      inject: [DATABASE],
      useFactory: (db: DbType) => new DrizzleMessageRepository(db),
    },
    {
      provide: MODEL_PROVIDER,
      useFactory: (): ModelProvider => {
        if (useMockProvider) {
          return new MockModelProvider();
        }
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey === undefined || apiKey.length === 0) {
          throw new Error('OPENAI_API_KEY es requerido si MODEL_PROVIDER != "mock"');
        }
        return new OpenAIModelProvider({ apiKey });
      },
    },
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: (): EmbeddingProvider => {
        if (useMockProvider) return new MockModelProvider();
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey === undefined || apiKey.length === 0) {
          throw new Error('OPENAI_API_KEY es requerido si MODEL_PROVIDER != "mock"');
        }
        return new OpenAIModelProvider({ apiKey });
      },
    },
    AgentsService,
    KnowledgeBasesService,
    DocumentsService,
    ConversationsService,
    WidgetService,
  ],
  controllers: [AgentsController, KnowledgeBasesController, DocumentsController, ConversationsController, ChatController, WidgetController],
  exports: [AgentsService, KnowledgeBasesService, DocumentsService, ConversationsService, WidgetService, MODEL_PROVIDER, EMBEDDING_PROVIDER, DrizzleConversationRepository, DrizzleMessageRepository],
})
export class AgentModule {}
