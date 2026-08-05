export type {
  ChannelAdapter,
  ConnectionStatus,
  DeliveryStatus,
  DeliveryStatusInput,
  DownloadedMedia,
  DownloadMediaInput,
  RawProviderEvent,
  SendChannelMessageInput,
  SendChannelMessageResult,
  VerifyConnectionInput,
} from './interfaces.js';
export { MockWhatsappAdapter, InMemoryMockWhatsappStorage, MOCK_WHATSAPP_PHONE_PREFIX } from './mock-whatsapp.js';
export { ChannelAdapterRegistry, buildDefaultRegistry } from './registry.js';
export type { MockWhatsappStorage } from './mock-whatsapp.js';
export type { NormalizedMessage, NormalizedParty, NormalizedAttachment } from '@platform/contracts';
