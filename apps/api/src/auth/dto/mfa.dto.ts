import { IsString, MinLength, MaxLength } from 'class-validator';

export class VerifyMfaDto {
  @IsString()
  mfaMethodId!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}