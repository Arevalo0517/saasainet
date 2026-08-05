import { pgEnum } from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
]);

export const userRoleScopeEnum = pgEnum('user_role_scope', ['PLATFORM', 'DISTRIBUTOR', 'CLIENT']);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'PENDING',
  'ACCEPTED',
  'REVOKED',
  'EXPIRED',
]);

export const mfaMethodTypeEnum = pgEnum('mfa_method_type', ['TOTP', 'EMAIL', 'SMS']);

export const mfaMethodStatusEnum = pgEnum('mfa_method_status', [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'DISABLED',
]);

export const distributorStatusEnum = pgEnum('distributor_status', ['ACTIVE', 'SUSPENDED', 'DEACTIVATED']);

export const clientStatusEnum = pgEnum('client_status', ['ACTIVE', 'SUSPENDED', 'DEACTIVATED']);

export const agentStateEnum = pgEnum('agent_state', ['DRAFT', 'TESTING', 'PUBLISHED', 'PAUSED', 'ARCHIVED']);

export const knowledgeBaseStatusEnum = pgEnum('knowledge_base_status', ['ACTIVE', 'PAUSED', 'ARCHIVED']);

export const documentStatusEnum = pgEnum('document_status', [
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED',
  'ARCHIVED',
]);

export const conversationStateEnum = pgEnum('conversation_state', [
  'NEW',
  'AI_ACTIVE',
  'WAITING_CUSTOMER',
  'HUMAN_REQUIRED',
  'ASSIGNED',
  'FOLLOW_UP',
  'RESOLVED',
  'CLOSED',
]);

export const messageDirectionEnum = pgEnum('message_direction', ['INBOUND', 'OUTBOUND']);

export const messageRoleEnum = pgEnum('message_role', ['USER', 'ASSISTANT', 'SYSTEM', 'TOOL']);
