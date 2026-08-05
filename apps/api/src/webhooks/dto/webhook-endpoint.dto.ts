import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export const WEBHOOK_EVENT_TYPES = [
  'agent.published',
  'conversation.started',
  'conversation.closed',
  'human.reply.created',
] as const;

export const WEBHOOK_ENDPOINT_STATUSES = ['ACTIVE', 'PAUSED'] as const;

export class CreateWebhookEndpointDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsUrl({ require_tld: false }, { message: 'url inválida' })
  @MaxLength(2048)
  url!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENT_TYPES, { each: true })
  events!: ReadonlyArray<(typeof WEBHOOK_EVENT_TYPES)[number]>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateWebhookEndpointDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENT_TYPES, { each: true })
  events?: ReadonlyArray<(typeof WEBHOOK_EVENT_TYPES)[number]>;

  @IsOptional()
  @IsIn(WEBHOOK_ENDPOINT_STATUSES)
  status?: (typeof WEBHOOK_ENDPOINT_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
