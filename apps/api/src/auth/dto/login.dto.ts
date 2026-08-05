import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsUUID()
  platformId!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  mfaCode?: string;
}