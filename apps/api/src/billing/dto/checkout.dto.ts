import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCheckoutDto {
  @IsUUID()
  clientId!: string;

  @IsUUID()
  planVersionId!: string;

  @IsOptional()
  @IsString()
  @Length(2, 8)
  @IsIn(['MONTHLY', 'ANNUAL'])
  billingInterval?: 'MONTHLY' | 'ANNUAL';

  @IsOptional()
  @IsString()
  @Length(1, 200)
  successUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  cancelUrl?: string;
}
