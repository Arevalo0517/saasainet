import { z } from 'zod';

export const LocaleSchema = z.enum(['es', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const CurrencySchema = z.enum(['mxn', 'usd', 'eur', 'ars', 'clp', 'cop', 'brl']);
export type Currency = z.infer<typeof CurrencySchema>;

export const AgentStateSchema = z.enum(['DRAFT', 'TESTING', 'PUBLISHED', 'PAUSED', 'ARCHIVED']);
export type AgentState = z.infer<typeof AgentStateSchema>;

export const ConversationStateSchema = z.enum([
  'NEW',
  'AI_ACTIVE',
  'WAITING_CUSTOMER',
  'HUMAN_REQUIRED',
  'ASSIGNED',
  'FOLLOW_UP',
  'RESOLVED',
  'CLOSED',
]);
export type ConversationState = z.infer<typeof ConversationStateSchema>;

export const ChannelSchema = z.enum(['WIDGET', 'WHATSAPP', 'TELEGRAM', 'MESSENGER', 'INSTAGRAM']);
export type Channel = z.infer<typeof ChannelSchema>;

export const ChannelConnectionStateSchema = z.enum([
  'NOT_CONFIGURED',
  'PENDING',
  'CONNECTED',
  'DEGRADED',
  'DISCONNECTED',
  'ERROR',
]);
export type ChannelConnectionState = z.infer<typeof ChannelConnectionStateSchema>;

export const MessageDirectionSchema = z.enum(['INBOUND', 'OUTBOUND']);
export type MessageDirection = z.infer<typeof MessageDirectionSchema>;

export const MessageTypeSchema = z.enum([
  'TEXT',
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'DOCUMENT',
  'LOCATION',
  'INTERACTIVE',
]);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const LedgerMovementTypeSchema = z.enum([
  'PLAN_GRANT',
  'PLAN_RENEWAL',
  'TOPUP_GRANT',
  'PROMOTIONAL_GRANT',
  'ADMIN_ADJUSTMENT',
  'MESSAGE_DEBIT',
  'EXPIRATION',
  'REFUND_REVERSAL',
  'CORRECTION',
]);
export type LedgerMovementType = z.infer<typeof LedgerMovementTypeSchema>;

export const CommissionStatusSchema = z.enum([
  'ESTIMATED',
  'PENDING',
  'AVAILABLE',
  'PAID',
  'REVERSED',
  'ON_HOLD',
]);
export type CommissionStatus = z.infer<typeof CommissionStatusSchema>;

export const PaymentStatusSchema = z.enum([
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
  'CHARGEBACKED',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
