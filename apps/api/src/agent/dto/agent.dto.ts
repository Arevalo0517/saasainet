import { IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';

const KEY_REGEX = /^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$/;

export class CreateAgentDto {
  @IsString()
  @Length(2, 64)
  @Matches(KEY_REGEX, { message: 'key debe ser slug (a-z, 0-9, _, -)' })
  key!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(2, 8)
  defaultLocale?: string;

  @IsOptional()
  @IsString()
  @Length(2, 64)
  defaultTimezone?: string;
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(2, 8)
  defaultLocale?: string;

  @IsOptional()
  @IsString()
  @Length(2, 64)
  defaultTimezone?: string;
}

export class CreateAgentVersionDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(2, 8)
  language?: string;

  @IsOptional()
  @IsString()
  @Length(2, 64)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  objective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  personality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tone?: string;

  @IsString()
  @MaxLength(20_000)
  systemPrompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  outOfHoursMessage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedRules?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbiddenRules?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataToRequest?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sensitiveDataForbidden?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  modelProfile?: string;

  @IsOptional()
  @IsObject()
  modelParameters?: Record<string, unknown>;
}

export class CreateKnowledgeBaseDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  embeddingModel?: string;

  @IsOptional()
  @IsInt()
  @Min(64)
  @Max(4096)
  embeddingDimensions?: number;
}

export class UpdateKnowledgeBaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  embeddingModel?: string;
}

export class CreateDocumentDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_073_741_824)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1_000_000)
  text?: string;
}

export class StartChatDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsUUID()
  agentId!: string;

  @IsString()
  @MaxLength(8000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  channel?: string;
}

export class TestAgentDto {
  @IsUUID()
  agentId!: string;

  @IsOptional()
  @IsUUID()
  agentVersionId?: string;

  @IsString()
  @MaxLength(8000)
  message!: string;
}
