import { Module, type FactoryProvider } from '@nestjs/common';
import { buildDefaultRegistry } from '@platform/channel-adapters';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChannelAdapterRegistry } from '@platform/channel-adapters';
import { JwtGuard } from '../auth/jwt.guard.js';
import { AuditModule } from '../audit/audit.module.js';
import { DATABASE } from '../infrastructure/database/database.module.js';
import type { Database as DbType } from '@platform/db';
import {
  DrizzleChannelConnectionsRepository,
  DrizzleMessageDeliveriesRepository,
} from '../infrastructure/persistence/drizzle/channels.repository.js';
import {
  DrizzleConversationRepository,
  DrizzleMessageRepository,
} from '../infrastructure/persistence/drizzle/conversations.repository.js';
import { ChannelConnectionsService } from './channel-connections.service.js';
import { ChannelMessagesService } from './channel-messages.service.js';
import { ChannelConnectionsController } from './channel-connections.controller.js';
import { MessageDeliveriesController } from './message-deliveries.controller.js';
import { ChannelsWebhookController } from './channels-webhook.controller.js';
import { ChannelsInboundProcessor } from './channels-inbound.processor.js';
import { CHANNEL_ADAPTER_REGISTRY } from './channels.tokens.js';


export { CHANNEL_ADAPTER_REGISTRY };

const registryProvider: FactoryProvider<ChannelAdapterRegistry> = {
  provide: CHANNEL_ADAPTER_REGISTRY,
  useFactory: (): ChannelAdapterRegistry => buildDefaultRegistry(),
};

const connectionsRepoProvider: FactoryProvider<DrizzleChannelConnectionsRepository> = {
  provide: DrizzleChannelConnectionsRepository,
  inject: [DATABASE],
  useFactory: (db: DbType): DrizzleChannelConnectionsRepository => new DrizzleChannelConnectionsRepository(db),
};

const deliveriesRepoProvider: FactoryProvider<DrizzleMessageDeliveriesRepository> = {
  provide: DrizzleMessageDeliveriesRepository,
  inject: [DATABASE],
  useFactory: (db: DbType): DrizzleMessageDeliveriesRepository => new DrizzleMessageDeliveriesRepository(db),
};

const inboundProcessorProvider: FactoryProvider<ChannelsInboundProcessor> = {
  provide: ChannelsInboundProcessor,
  inject: [
    DrizzleChannelConnectionsRepository,
    DrizzleConversationRepository,
    DrizzleMessageRepository,
    ChannelConnectionsService,
    CHANNEL_ADAPTER_REGISTRY,
  ],
  useFactory: (
    connections: DrizzleChannelConnectionsRepository,
    conversations: DrizzleConversationRepository,
    messages: DrizzleMessageRepository,
    connService: ChannelConnectionsService,
    registry: ChannelAdapterRegistry,
  ): ChannelsInboundProcessor =>
    new ChannelsInboundProcessor(connections, conversations, messages, connService, registry),
};

@Module({
  imports: [AuditModule],
  providers: [
    JwtGuard,
    registryProvider,
    connectionsRepoProvider,
    deliveriesRepoProvider,
    {
      provide: DrizzleConversationRepository,
      inject: [DATABASE],
      useFactory: (db: DbType): DrizzleConversationRepository => new DrizzleConversationRepository(db),
    },
    {
      provide: DrizzleMessageRepository,
      inject: [DATABASE],
      useFactory: (db: DbType): DrizzleMessageRepository => new DrizzleMessageRepository(db),
    },
    ChannelConnectionsService,
    ChannelMessagesService,
    inboundProcessorProvider,
  ],
  controllers: [ChannelConnectionsController, MessageDeliveriesController, ChannelsWebhookController],
  exports: [CHANNEL_ADAPTER_REGISTRY, DrizzleChannelConnectionsRepository, DrizzleMessageDeliveriesRepository, ChannelMessagesService],
})
export class ChannelsModule {}
