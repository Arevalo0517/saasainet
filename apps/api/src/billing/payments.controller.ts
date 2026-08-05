import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { JwtGuard } from '../auth/jwt.guard.js';
import type { CreateCheckoutDto } from './dto/checkout.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaymentsService } from './payments.service.js';
import type { PaymentRecord } from '../infrastructure/persistence/drizzle/payments.repository.js';

const toTenantContext = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing — JwtGuard debe correr antes');
  return ctx;
};

const toPaymentDto = (p: PaymentRecord): Record<string, unknown> => ({
  id: p.id,
  clientId: p.clientId,
  distributorId: p.distributorId,
  paymentCustomerId: p.paymentCustomerId,
  provider: p.provider,
  providerPaymentId: p.providerPaymentId,
  kind: p.kind,
  amountCents: p.amountCents,
  currency: p.currency,
  status: p.status,
  description: p.description,
  paidAt: p.paidAt?.toISOString() ?? null,
  failedAt: p.failedAt?.toISOString() ?? null,
  createdAt: p.createdAt.toISOString(),
});

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Crea checkout de suscripción (Mock)' })
  async createCheckout(@Req() req: Request, @Body() dto: CreateCheckoutDto): Promise<{ checkoutUrl: string; providerReference: string; paymentId: string }> {
    const ctx = toTenantContext(req);
    return this.service.createCheckout(ctx, {
      clientId: dto.clientId,
      planVersionId: dto.planVersionId,
      billingInterval: dto.billingInterval ?? 'MONTHLY',
      successUrl: dto.successUrl ?? 'https://app.local/success',
      cancelUrl: dto.cancelUrl ?? 'https://app.local/cancel',
    });
  }

  @Get()
  @ApiOperation({ summary: 'Lista pagos según scope' })
  async list(@Req() req: Request): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.listForScope(ctx);
    return { items: items.map(toPaymentDto) };
  }

  @Get('commissions/:distributorId')
  @ApiOperation({ summary: 'Lista comisiones de un distribuidor' })
  async listCommissions(
    @Req() req: Request,
    @Param('distributorId') distributorId: string,
  ): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.listCommissions(ctx, distributorId);
    return {
      items: items.map((c) => ({
        id: c.id,
        distributorId: c.distributorId,
        clientId: c.clientId,
        paymentId: c.paymentId,
        eligibleAmountCents: c.eligibleAmountCents,
        commissionRate: c.commissionRate,
        commissionAmountCents: c.commissionAmountCents,
        currency: c.currency,
        status: c.status,
        availableAt: c.availableAt?.toISOString() ?? null,
        paidAt: c.paidAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }
}
