import { IsBoolean, IsEmail, IsHexColor, IsOptional, IsString, IsUrl, Length, Matches, MaxLength } from 'class-validator';

const KEY_REGEX = /^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$/;

export class CreateDistributorDto {
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

  @IsOptional()
  @IsBoolean()
  whiteLabelEnabled?: boolean;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  customDomain?: string;
}

export class UpdateDistributorDto {
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
  @IsBoolean()
  whiteLabelEnabled?: boolean;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  customDomain?: string;

  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}
