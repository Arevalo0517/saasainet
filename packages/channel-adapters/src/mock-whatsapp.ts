import type {
  Channel,
  NormalizedMessage,
} from '@platform/contracts';
import { randomBytes } from 'node:crypto';
import {
  type ChannelAdapter,
  type ConnectionStatus,
  type DeliveryStatus,
  type DeliveryStatusInput,
  type DownloadedMedia,
  type DownloadMediaInput,
  type RawProviderEvent,
  type SendChannelMessageInput,
  type SendChannelMessageResult,
  type VerifyConnectionInput,
} from './index.js';

export const MOCK_WHATSAPP_PHONE_PREFIX = '+15555550';

export interface MockWhatsappStorage {
  /**
   * Devuelve el estado actual de un provider_message_id.
   * Default: SENT. Si se inyecta un storage, permite manipular
   * la máquina de estados desde los tests.
   */
  getStatus(providerMessageId: string): DeliveryStatus;
  setStatus(providerMessageId: string, status: DeliveryStatus): void;
  /** Fails the next outbound send with the given error. */
  failNextSend(errorCode: string, errorMessage: string): void;
}

export class InMemoryMockWhatsappStorage implements MockWhatsappStorage {
  private readonly states = new Map<string, DeliveryStatus>();
  private nextFailure: { errorCode: string; errorMessage: string } | null = null;

  getStatus(providerMessageId: string): DeliveryStatus {
    return this.states.get(providerMessageId) ?? { status: 'SENT' };
  }

  setStatus(providerMessageId: string, status: DeliveryStatus): void {
    this.states.set(providerMessageId, status);
  }

  failNextSend(errorCode: string, errorMessage: string): void {
    this.nextFailure = { errorCode, errorMessage };
  }

  consumeFailure(): { errorCode: string; errorMessage: string } | null {
    const f = this.nextFailure;
    this.nextFailure = null;
    return f;
  }
}

const generateId = (prefix: string): string => `${prefix}_${randomBytes(12).toString('hex')}`;

export class MockWhatsappAdapter implements ChannelAdapter {
  readonly channel: Channel = 'WHATSAPP';

  constructor(private readonly storage: MockWhatsappStorage = new InMemoryMockWhatsappStorage()) {}

  async verifyConnection(input: VerifyConnectionInput): Promise<ConnectionStatus> {
    if (input.credentials['api_key'] === undefined || input.credentials['api_key'].length < 8) {
      return { state: 'ERROR', message: 'api_key inválida o ausente' };
    }
    if (input.credentials['phone_number_id'] === undefined || input.credentials['phone_number_id'].length < 3) {
      return { state: 'ERROR', message: 'phone_number_id inválido' };
    }
    return { state: 'CONNECTED', metadata: { mock: true, verifiedAt: new Date().toISOString() } };
  }

  async parseInboundEvent(input: RawProviderEvent): Promise<NormalizedMessage[]> {
    const payload = input.payload as { entry?: Array<{ changes?: Array<{ value?: { messages?: unknown[]; contacts?: unknown[] } }> }> } | undefined;
    const raw = payload?.entry?.[0]?.changes?.[0]?.value;
    if (raw === undefined) return [];
    const messages = Array.isArray(raw.messages) ? raw.messages : [];
    const contacts = Array.isArray(raw.contacts) ? raw.contacts : [];
    const out: NormalizedMessage[] = [];
    for (const m of messages) {
      const msg = m as { id: string; from: string; timestamp: string; type?: string; text?: { body?: string } };
      const contact = (contacts as Array<{ wa_id: string; profile?: { name?: string } }>).find((c) => c.wa_id === msg.from);
      out.push({
        id: crypto.randomUUID(),
        providerEventId: input.providerEventId,
        platformId: '',
        clientId: '',
        channelConnectionId: input.channelConnectionId,
        externalConversationId: msg.from,
        externalMessageId: msg.id,
        direction: 'INBOUND',
        sender: {
          externalId: msg.from,
          displayName: contact?.profile?.name ?? null,
          phone: msg.from,
          email: null,
        },
        recipient: {
          externalId: MOCK_WHATSAPP_PHONE_PREFIX + '000',
          displayName: null,
          phone: MOCK_WHATSAPP_PHONE_PREFIX + '000',
          email: null,
        },
        channel: 'WHATSAPP',
        messageType: msg.type === 'text' ? 'TEXT' : 'TEXT',
        text: msg.text?.body ?? null,
        attachments: [],
        occurredAt: new Date(Number(msg.timestamp) * 1000).toISOString(),
        rawPayloadReference: input.rawPayloadReference,
      });
    }
    return out;
  }

  async sendMessage(_input: SendChannelMessageInput): Promise<SendChannelMessageResult> {
    const failure = (this.storage as InMemoryMockWhatsappStorage).consumeFailure?.();
    if (failure !== null && failure !== undefined) {
      throw new Error(`[mock-whatsapp] ${failure.errorCode}: ${failure.errorMessage}`);
    }
    const providerMessageId = generateId('wamid');
    this.storage.setStatus(providerMessageId, { status: 'SENT' });
    return { providerMessageId, status: 'CONNECTED' };
  }

  async downloadMedia(_input: DownloadMediaInput): Promise<DownloadedMedia> {
    return { url: 'about:blank', mimeType: 'application/octet-stream', sizeBytes: 0 };
  }

  async getDeliveryStatus(input: DeliveryStatusInput): Promise<DeliveryStatus> {
    return this.storage.getStatus(input.providerMessageId);
  }
}

export const PLACEHOLDER_MOCK = 'MockWhatsappAdapter (Fase 7)';
void PLACEHOLDER_MOCK;
