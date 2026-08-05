import type { ChannelConnectionState, Channel, NormalizedMessage } from '@platform/contracts';

export interface VerifyConnectionInput {
  channelConnectionId: string;
  credentials: Record<string, string>;
}

export interface ConnectionStatus {
  state: ChannelConnectionState;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface RawProviderEvent {
  channel: Channel;
  channelConnectionId: string;
  providerEventId: string;
  payload: unknown;
  headers?: Record<string, string>;
  rawPayloadReference: string;
}

export interface SendChannelMessageInput {
  channelConnectionId: string;
  conversationExternalId: string;
  recipient: NormalizedMessage['recipient'];
  text?: string;
  attachments?: NormalizedMessage['attachments'];
  replyToMessageId?: string;
}

export interface SendChannelMessageResult {
  providerMessageId: string;
  status: ChannelConnectionState;
}

export interface DownloadMediaInput {
  providerMediaId: string;
  channelConnectionId: string;
}

export interface DownloadedMedia {
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export interface DeliveryStatusInput {
  channelConnectionId: string;
  providerMessageId: string;
}

export interface DeliveryStatus {
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  errorCode?: string;
  errorMessage?: string;
}

export interface ChannelAdapter {
  readonly channel: Channel;
  verifyConnection(input: VerifyConnectionInput): Promise<ConnectionStatus>;
  parseInboundEvent(input: RawProviderEvent): Promise<NormalizedMessage[]>;
  sendMessage(input: SendChannelMessageInput): Promise<SendChannelMessageResult>;
  downloadMedia(input: DownloadMediaInput): Promise<DownloadedMedia>;
  getDeliveryStatus(input: DeliveryStatusInput): Promise<DeliveryStatus>;
}
