import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WidgetService } from './widget.service.js';

export class WidgetChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  conversationExternalId!: string;

  @IsString()
  @MaxLength(8000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerDisplayName?: string;
}

interface WidgetConfigResponse {
  publicWidgetId: string;
  agentId: string;
  agentName: string;
  welcomeMessage: string;
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  title: string;
}

@ApiTags('widget')
@Controller('widget')
export class WidgetController {
  constructor(private readonly service: WidgetService) {}

  @Get(':publicWidgetId/config')
  @ApiOperation({ summary: 'Config pública del widget (sin auth)' })
  async getConfig(@Param('publicWidgetId') publicWidgetId: string): Promise<WidgetConfigResponse> {
    const c = await this.service.getConfig(publicWidgetId);
    return c;
  }

  @Post(':publicWidgetId/chat')
  @ApiOperation({ summary: 'Chat anónimo vía widget (sin auth)' })
  async chat(
    @Param('publicWidgetId') publicWidgetId: string,
    @Body() dto: WidgetChatDto,
  ): Promise<Record<string, unknown>> {
    const r = await this.service.chat(publicWidgetId, {
      conversationExternalId: dto.conversationExternalId,
      message: dto.message,
      customerDisplayName: dto.customerDisplayName ?? null,
    });
    return {
      conversationExternalId: r.conversationExternalId,
      inbound: {
        id: r.inbound.id,
        content: r.inbound.content,
        direction: r.inbound.direction,
        createdAt: r.inbound.createdAt.toISOString(),
      },
      outbound: {
        id: r.outbound.id,
        content: r.outbound.content,
        direction: r.outbound.direction,
        citations: r.outbound.citations,
        createdAt: r.outbound.createdAt.toISOString(),
      },
      tokensUsed: r.tokensUsed,
      latencyMs: r.latencyMs,
    };
  }
}
