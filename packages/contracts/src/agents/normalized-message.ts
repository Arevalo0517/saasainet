import { z } from 'zod';
import { ChannelSchema, MessageDirectionSchema, MessageTypeSchema } from '../shared/enums.js';

export const NormalizedPartySchema = z.object({
  externalId: z.string(),
  displayName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
});
export type NormalizedParty = z.infer<typeof NormalizedPartySchema>;

export const NormalizedAttachmentSchema = z.object({
  id: z.string(),
  mediaType: MessageTypeSchema,
  url: z.string().url(),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  filename: z.string().nullable().optional(),
});
export type NormalizedAttachment = z.infer<typeof NormalizedAttachmentSchema>;

export const NormalizedMessageSchema = z.object({
  id: z.string().uuid(),
  providerEventId: z.string(),
  platformId: z.string().uuid(),
  distributorId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid(),
  channelConnectionId: z.string().uuid(),
  externalConversationId: z.string(),
  externalMessageId: z.string(),
  direction: MessageDirectionSchema,
  sender: NormalizedPartySchema,
  recipient: NormalizedPartySchema,
  channel: ChannelSchema,
  messageType: MessageTypeSchema,
  text: z.string().nullable().optional(),
  attachments: z.array(NormalizedAttachmentSchema).default([]),
  occurredAt: z.string().datetime(),
  rawPayloadReference: z.string(),
});
export type NormalizedMessage = z.infer<typeof NormalizedMessageSchema>;
