import { describe, it, expect } from 'vitest';
import { TenantContextSchema } from '../src/tenancy/tenant-context';
import { NormalizedMessageSchema } from '../src/agents/normalized-message';
import { CommissionEntrySchema } from '../src/billing/commissions';

describe('contracts smoke', () => {
  it('validates tenant context', () => {
    const result = TenantContextSchema.safeParse({
      platformId: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      roles: ['PLATFORM_SUPER_ADMIN'],
      permissions: ['*'],
      isSupportSession: false,
    });
    expect(result.success).toBe(true);
  });

  it('validates normalized message', () => {
    const result = NormalizedMessageSchema.safeParse({
      id: '33333333-3333-3333-3333-333333333333',
      providerEventId: 'evt_1',
      platformId: '11111111-1111-1111-1111-111111111111',
      clientId: '44444444-4444-4444-4444-444444444444',
      channelConnectionId: '55555555-5555-5555-5555-555555555555',
      externalConversationId: 'conv_external_1',
      externalMessageId: 'msg_external_1',
      direction: 'INBOUND',
      sender: { externalId: 'user_1' },
      recipient: { externalId: 'bot_1' },
      channel: 'WIDGET',
      messageType: 'TEXT',
      text: 'hola',
      occurredAt: new Date().toISOString(),
      rawPayloadReference: 'storage://raw/1',
    });
    expect(result.success).toBe(true);
  });

  it('validates commission entry', () => {
    const result = CommissionEntrySchema.safeParse({
      id: '66666666-6666-6666-6666-666666666666',
      distributorId: '77777777-7777-7777-7777-777777777777',
      clientId: '44444444-4444-4444-4444-444444444444',
      paymentId: '88888888-8888-8888-8888-888888888888',
      eligibleAmountCents: 10000,
      commissionRate: 0.2,
      commissionAmountCents: 2000,
      currency: 'mxn',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});
