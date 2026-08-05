import type { Channel } from '@platform/contracts';
import type { ChannelAdapter, ConnectionStatus, DeliveryStatus, DeliveryStatusInput, DownloadedMedia, DownloadMediaInput, RawProviderEvent, SendChannelMessageInput, SendChannelMessageResult, VerifyConnectionInput } from './index.js';
import { MockWhatsappAdapter } from './mock-whatsapp.js';

export class ChannelAdapterRegistry {
  private readonly adapters = new Map<Channel, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  get(channel: Channel): ChannelAdapter {
    const a = this.adapters.get(channel);
    if (a === undefined) throw new Error(`no adapter registered for channel ${channel}`);
    return a;
  }

  has(channel: Channel): boolean {
    return this.adapters.has(channel);
  }

  list(): Channel[] {
    return Array.from(this.adapters.keys());
  }
}

export const buildDefaultRegistry = (): ChannelAdapterRegistry => {
  const r = new ChannelAdapterRegistry();
  r.register(new MockWhatsappAdapter());
  return r;
};

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
};
