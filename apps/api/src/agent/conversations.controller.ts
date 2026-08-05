import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { IsString, MaxLength } from 'class-validator';
import { JwtGuard } from '../auth/jwt.guard.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConversationsService } from './conversations.service.js';
import type { ConversationRecord, MessageRecord } from '../infrastructure/persistence/drizzle/conversations.repository.js';
import type { StartChatDto, TestAgentDto } from './dto/agent.dto.js';

export class HumanReplyDto {
  @IsString()
  @MaxLength(8000)
  content!: string;
}

const toTenantContext = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing');
  return ctx;
};

const toConvDto = (c: ConversationRecord): Record<string, unknown> => ({
  id: c.id,
  clientId: c.clientId,
  agentId: c.agentId,
  agentVersionId: c.agentVersionId,
  channel: c.channel,
  state: c.state,
  customerDisplayName: c.customerDisplayName,
  customerExternalId: c.customerExternalId,
  lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
  messageCount: c.messageCount,
  createdAt: c.createdAt.toISOString(),
  closedAt: c.closedAt?.toISOString() ?? null,
});

const toMsgDto = (m: MessageRecord): Record<string, unknown> => ({
  id: m.id,
  conversationId: m.conversationId,
  direction: m.direction,
  role: m.role,
  content: m.content,
  tokenCount: m.tokenCount,
  citations: m.citations,
  createdAt: m.createdAt.toISOString(),
});

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Lista conversaciones del client' })
  async list(@Req() req: Request): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.listByClient(ctx, 50);
    return { items: items.map(toConvDto) };
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Detalle de conversación' })
  async getOne(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    return toConvDto(await this.service.getById(ctx, id));
  }

  @Get(':id/messages')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Lista mensajes de una conversación' })
  async listMessages(@Req() req: Request, @Param('id') id: string): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.listMessages(ctx, id);
    return { items: items.map(toMsgDto) };
  }

  @Post(':id/reply')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Responde como humano a una conversación' })
  async reply(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: HumanReplyDto,
  ): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const r = await this.service.humanReply(ctx, id, dto.content);
    return { conversation: toConvDto(r.conversation), message: toMsgDto(r.message) };
  }

  @Post(':id/close')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Cierra una conversación' })
  async close(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    return toConvDto(await this.service.closeConversation(ctx, id));
  }
}

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly service: ConversationsService) {}

  @Post()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Envía un mensaje al agent (crea conv si no hay conversationId)' })
  async start(@Req() req: Request, @Body() dto: StartChatDto): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const r = await this.service.startChat(ctx, {
      conversationId: dto.conversationId ?? null,
      agentId: dto.agentId,
      message: dto.message,
      channel: dto.channel ?? 'WIDGET',
    });
    return {
      conversation: toConvDto(r.conversation),
      inbound: toMsgDto(r.inbound),
      outbound: toMsgDto(r.outbound),
      tokensUsed: r.tokensUsed,
      latencyMs: r.latencyMs,
    };
  }

  @Post('test')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Testea un agent sin persistir mensajes (preview)' })
  async test(@Req() req: Request, @Body() dto: TestAgentDto): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const r = await this.service.testAgent(ctx, {
      agentId: dto.agentId,
      agentVersionId: dto.agentVersionId ?? null,
      message: dto.message,
    });
    return r;
  }
}
