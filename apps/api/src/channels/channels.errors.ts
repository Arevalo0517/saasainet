export class ChannelError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ChannelError';
  }
}

export const CHANNEL_CONNECTION_NOT_FOUND = (id: string): ChannelError =>
  new ChannelError('CHANNEL_CONNECTION_NOT_FOUND', 404, `channel connection ${id} no encontrada`);

export const CROSS_TENANT_CHANNEL = (): ChannelError =>
  new ChannelError('CROSS_TENANT_CHANNEL', 403, 'channel connection de otro tenant');

export const INVALID_CHANNEL = (channel: string): ChannelError =>
  new ChannelError('INVALID_CHANNEL', 400, `canal no soportado: ${channel}`);

export const WEBHOOK_SIGNATURE_INVALID = (): ChannelError =>
  new ChannelError('WEBHOOK_SIGNATURE_INVALID', 401, 'firma del webhook inválida');

export const DELIVERY_NOT_FOUND = (id: string): ChannelError =>
  new ChannelError('DELIVERY_NOT_FOUND', 404, `delivery ${id} no encontrada`);

export const DELIVERY_NOT_FOR_CONNECTION = (): ChannelError =>
  new ChannelError('DELIVERY_NOT_FOR_CONNECTION', 400, 'delivery no pertenece a esta conexión');
