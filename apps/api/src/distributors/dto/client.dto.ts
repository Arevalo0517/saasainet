import { IsArray, IsEmail, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

const KEY_REGEX = /^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$/;

export class CreateClientDto {
  @IsUUID()
  distributorId!: string;

  @IsString()
  @Length(2, 64)
  @Matches(KEY_REGEX, { message: 'key debe ser slug (a-z, 0-9, _, -)' })
  key!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(250)
  legalName!: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsString()
  @Length(2, 8)
  defaultLocale?: string;

  @IsOptional()
  @IsString()
  @Length(2, 8)
  defaultCurrency?: string;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  legalName?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsString()
  @Length(2, 8)
  defaultLocale?: string;

  @IsOptional()
  @IsString()
  @Length(2, 8)
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}

export class UpdateWebhookAllowedHostsDto {
  @IsArray()
  hosts!: string[];
}
