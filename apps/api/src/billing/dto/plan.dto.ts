import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

const CODE_REGEX = /^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$/;

export class CreatePlanDto {
  @IsString()
  @Length(2, 64)
  @Matches(CODE_REGEX, { message: 'code debe ser slug (a-z, 0-9, _, -)' })
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreatePlanVersionDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsInt()
  @Min(0)
  @Max(10_000_000)
  monthlyPriceCents!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  annualPriceCents?: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  includedMessageCredits!: number;

  @IsInt()
  @Min(0)
  @Max(10_000_000)
  overageUnitPriceCents!: number;

  @IsOptional()
  @IsString({ each: true })
  features?: string[];
}
