export class WebhookError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'WebhookError';
  }
}

export const WEBHOOK_NOT_FOUND = (id: string): WebhookError =>
  new WebhookError('WEBHOOK_NOT_FOUND', 404, `webhook endpoint ${id} no encontrado`);

export const WEBHOOK_AGENT_NOT_PUBLISHED = (agentId: string): WebhookError =>
  new WebhookError('WEBHOOK_AGENT_NOT_PUBLISHED', 400, `agent ${agentId} no está en estado PUBLISHED`);

export const CROSS_TENANT_ENDPOINT = (): WebhookError =>
  new WebhookError('CROSS_TENANT_ENDPOINT', 403, 'endpoint de otro tenant');

export const DELIVERY_NOT_FOUND = (id: string): WebhookError =>
  new WebhookError('DELIVERY_NOT_FOUND', 404, `delivery ${id} no encontrada`);

export const DELIVERY_CANNOT_REPLAY = (status: string): WebhookError =>
  new WebhookError(
    'DELIVERY_CANNOT_REPLAY',
    400,
    `no se puede reintentar una delivery en estado ${status}`,
  );
