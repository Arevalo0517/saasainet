import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaymentsService } from './payments.service.js';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook de pagos (Mock, HMAC SHA-256)' })
  async handlePayment(@Req() req: Request): Promise<{ ok: true; paymentId: string; commissionId?: string }> {
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
    const signature = (req.headers['x-mock-signature'] as string | undefined) ?? '';
    return this.payments.handleWebhook(rawBody, signature);
  }
}
