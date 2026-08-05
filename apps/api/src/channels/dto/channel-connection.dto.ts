import { IsIn, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const CHANNEL_TYPES = ['WHATSAPP', 'TELEGRAM', 'MESSENGER', 'INSTAGRAM'] as const;

export class CreateChannelConnectionDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(CHANNEL_TYPES)
  channel!: (typeof CHANNEL_TYPES)[number];

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{6,15}$/, { message: 'phoneNumber inválido' })
  phoneNumber?: string;

  @IsObject()
  @IsOptional()
  credentials?: Record<string, string>;
}

export class UpdateChannelConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{6,15}$/, { message: 'phoneNumber inválido' })
  phoneNumber?: string;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}
