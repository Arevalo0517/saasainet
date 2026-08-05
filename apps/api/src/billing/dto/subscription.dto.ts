import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSubscriptionDto {
  @IsUUID()
  clientId!: string;

  @IsUUID()
  planVersionId!: string;

  @IsOptional()
  @IsIn(['MONTHLY', 'ANNUAL'])
  billingInterval?: 'MONTHLY' | 'ANNUAL';
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(24)
  @IsIn(['PENDING_ACTIVATION', 'ACTIVE', 'CANCELLED', 'EXPIRED', 'SUSPENDED'])
  status?: 'PENDING_ACTIVATION' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED';
}
