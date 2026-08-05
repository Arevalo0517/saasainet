import { relations } from 'drizzle-orm';
import { platforms } from './platforms.js';
import { roles } from './roles.js';
import { permissions } from './permissions.js';
import { rolePermissions } from './role-permissions.js';
import { users } from './users.js';
import { userRoles } from './user-roles.js';
import { invitations } from './invitations.js';
import { sessions } from './sessions.js';
import { mfaMethods } from './mfa-methods.js';
import { distributors } from './distributors.js';
import { clients } from './clients.js';
import { plans, planVersions, subscriptions } from './plans.js';
import { paymentCustomers, payments, commissionEntries, payouts } from './billing.js';
import { agents, agentVersions } from './agents.js';
import { knowledgeBases, documents, chunks } from './knowledge.js';
import { conversations, messages } from './conversations.js';

export const platformsRelations = relations(platforms, ({ many }) => ({
  users: many(users),
  invitations: many(invitations),
  sessions: many(sessions),
  distributors: many(distributors),
  plans: many(plans),
}));

export const distributorsRelations = relations(distributors, ({ one, many }) => ({
  platform: one(platforms, { fields: [distributors.platformId], references: [platforms.id] }),
  clients: many(clients),
  subscriptions: many(subscriptions),
  payments: many(payments),
  commissionEntries: many(commissionEntries),
  payouts: many(payouts),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  platform: one(platforms, { fields: [clients.platformId], references: [platforms.id] }),
  distributor: one(distributors, { fields: [clients.distributorId], references: [distributors.id] }),
  subscriptions: many(subscriptions),
  payments: many(payments),
  agents: many(agents),
  knowledgeBases: many(knowledgeBases),
  documents: many(documents),
  conversations: many(conversations),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  platform: one(platforms, { fields: [users.platformId], references: [platforms.id] }),
  userRoles: many(userRoles),
  sessions: many(sessions),
  mfaMethods: many(mfaMethods),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  invitedByUser: one(users, { fields: [invitations.invitedBy], references: [users.id] }),
  acceptedByUser: one(users, { fields: [invitations.acceptedBy], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const mfaMethodsRelations = relations(mfaMethods, ({ one }) => ({
  user: one(users, { fields: [mfaMethods.userId], references: [users.id] }),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  platform: one(platforms, { fields: [plans.platformId], references: [platforms.id] }),
  versions: many(planVersions),
  subscriptions: many(subscriptions),
}));

export const planVersionsRelations = relations(planVersions, ({ one, many }) => ({
  plan: one(plans, { fields: [planVersions.planId], references: [plans.id] }),
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  platform: one(platforms, { fields: [subscriptions.platformId], references: [platforms.id] }),
  distributor: one(distributors, { fields: [subscriptions.distributorId], references: [distributors.id] }),
  client: one(clients, { fields: [subscriptions.clientId], references: [clients.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
  planVersion: one(planVersions, { fields: [subscriptions.planVersionId], references: [planVersions.id] }),
}));

export const paymentCustomersRelations = relations(paymentCustomers, ({ one, many }) => ({
  platform: one(platforms, { fields: [paymentCustomers.platformId], references: [platforms.id] }),
  distributor: one(distributors, { fields: [paymentCustomers.distributorId], references: [distributors.id] }),
  client: one(clients, { fields: [paymentCustomers.clientId], references: [clients.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  platform: one(platforms, { fields: [payments.platformId], references: [platforms.id] }),
  distributor: one(distributors, { fields: [payments.distributorId], references: [distributors.id] }),
  client: one(clients, { fields: [payments.clientId], references: [clients.id] }),
  customer: one(paymentCustomers, { fields: [payments.paymentCustomerId], references: [paymentCustomers.id] }),
  commissionEntries: many(commissionEntries),
}));

export const commissionEntriesRelations = relations(commissionEntries, ({ one }) => ({
  platform: one(platforms, { fields: [commissionEntries.platformId], references: [platforms.id] }),
  distributor: one(distributors, { fields: [commissionEntries.distributorId], references: [distributors.id] }),
  client: one(clients, { fields: [commissionEntries.clientId], references: [clients.id] }),
  payment: one(payments, { fields: [commissionEntries.paymentId], references: [payments.id] }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  platform: one(platforms, { fields: [payouts.platformId], references: [platforms.id] }),
  distributor: one(distributors, { fields: [payouts.distributorId], references: [distributors.id] }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  platform: one(platforms, { fields: [agents.platformId], references: [platforms.id] }),
  distributor: one(distributors, { fields: [agents.distributorId], references: [distributors.id] }),
  client: one(clients, { fields: [agents.clientId], references: [clients.id] }),
  versions: many(agentVersions),
  knowledgeBases: many(knowledgeBases),
  conversations: many(conversations),
}));

export const agentVersionsRelations = relations(agentVersions, ({ one, many }) => ({
  agent: one(agents, { fields: [agentVersions.agentId], references: [agents.id] }),
  conversations: many(conversations),
}));

export const knowledgeBasesRelations = relations(knowledgeBases, ({ one, many }) => ({
  platform: one(platforms, { fields: [knowledgeBases.platformId], references: [platforms.id] }),
  distributor: one(distributors, { fields: [knowledgeBases.distributorId], references: [distributors.id] }),
  client: one(clients, { fields: [knowledgeBases.clientId], references: [clients.id] }),
  agent: one(agents, { fields: [knowledgeBases.agentId], references: [agents.id] }),
  documents: many(documents),
  chunks: many(chunks),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  platform: one(platforms, { fields: [documents.platformId], references: [platforms.id] }),
  distributor: one(distributors, { fields: [documents.distributorId], references: [distributors.id] }),
  client: one(clients, { fields: [documents.clientId], references: [clients.id] }),
  knowledgeBase: one(knowledgeBases, { fields: [documents.knowledgeBaseId], references: [knowledgeBases.id] }),
  chunks: many(chunks),
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, { fields: [chunks.documentId], references: [documents.id] }),
  knowledgeBase: one(knowledgeBases, { fields: [chunks.knowledgeBaseId], references: [knowledgeBases.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  platform: one(platforms, { fields: [conversations.platformId], references: [platforms.id] }),
  distributor: one(distributors, { fields: [conversations.distributorId], references: [distributors.id] }),
  client: one(clients, { fields: [conversations.clientId], references: [clients.id] }),
  agent: one(agents, { fields: [conversations.agentId], references: [agents.id] }),
  agentVersion: one(agentVersions, { fields: [conversations.agentVersionId], references: [agentVersions.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));
