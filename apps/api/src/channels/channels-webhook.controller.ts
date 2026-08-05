import { Controller, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChannelConnectionsService, verifyWebhookSignature } from './channel-connections.service.js';
import { WEBHOOK_SIGNATURE_INVALID } from './channels.errors.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChannelsInboundProcessor } from './channels-inbound.processor.js';

@ApiTags('channels-webhook')
@Controller('channels/:channel/webhook')
export class ChannelsWebhookController {
  constructor(
    private readonly connections: ChannelConnectionsService,
    private readonly inbound: ChannelsInboundProcessor,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook público de un canal (verifica HMAC)' })
  async handle(
    @Req() req: Request,
    @Param('channel') channel: string,
    @Headers('x-channel-signature') signature: string | undefined,
    @Headers('x-channel-event-id') eventIdHeader: string | undefined,
  ): Promise<{ received: number; conversationId?: string; messageId?: string }> {
    const raw = (req as Request & { rawBody?: string | Buffer }).rawBody;
    const rawBody: string =
      typeof raw === 'string' ? raw : raw === undefined ? JSON.stringify(req.body ?? {}) : raw.toString('utf8');
    const parsed =
      typeof req.body === 'object' && req.body !== null
        ? (req.body as { connectionId?: string; agentId?: string })
        : {};
    const connectionId = parsed.connectionId ?? '';
    const agentId = parsed.agentId ?? '';
    if (connectionId.length === 0 || agentId.length === 0) throw WEBHOOK_SIGNATURE_INVALID();
    const decrypted = await this.connections.getDecryptedByIdAny(connectionId);
    if (decrypted === null) throw WEBHOOK_SIGNATURE_INVALID();
    if (decrypted.record.channel !== channel) throw WEBHOOK_SIGNATURE_INVALID();
    if (!verifyWebhookSignature(rawBody, signature, decrypted.webhookSecret)) {
      throw WEBHOOK_SIGNATURE_INVALID();
    }
    const providerEventId = eventIdHeader ?? `ch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return this.inbound.processInbound(decrypted.record.id, agentId, channel, parsed, providerEventId, rawBody);
  }
}
