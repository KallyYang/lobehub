import { index, jsonb, pgTable, primaryKey, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { idGenerator, randomSlug } from '../utils/idGenerator';
import { createdAt, timestamptz, timestamps } from './_helpers';
import { users } from './user';

// ======= workspaces ======= //

export const workspaces = pgTable(
  'workspaces',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('workspaces'))
      .notNull(),
    slug: varchar('slug', { length: 100 })
      .notNull()
      .$defaultFn(() => randomSlug(3)),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    avatar: text('avatar'),

    // 'personal' = auto-created per user, 'team' = collaborative workspace
    type: text('type', { enum: ['personal', 'team'] })
      .notNull()
      .default('team'),

    ownerId: text('owner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Workspace-level settings (default agent config, theme, etc.)
    settings: jsonb('settings').default({}),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('workspaces_slug_idx').on(table.slug),
    index('workspaces_owner_id_idx').on(table.ownerId),
    index('workspaces_type_idx').on(table.type),
  ],
);

export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceItem = typeof workspaces.$inferSelect;

// ======= workspace_members ======= //

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: text('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // 'owner' | 'admin' | 'editor' | 'member'
    role: text('role', { enum: ['owner', 'admin', 'editor', 'member'] })
      .notNull()
      .default('member'),

    joinedAt: timestamptz('joined_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index('workspace_members_user_id_idx').on(table.userId),
    index('workspace_members_workspace_id_idx').on(table.workspaceId),
  ],
);

export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type WorkspaceMemberItem = typeof workspaceMembers.$inferSelect;

// ======= workspace_invitations ======= //

export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('workspaceInvitations'))
      .notNull(),

    workspaceId: text('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    inviterId: text('inviter_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    email: text('email'),

    // Role to assign when invitation is accepted
    role: text('role', { enum: ['admin', 'editor', 'member'] })
      .notNull()
      .default('member'),

    token: text('token').unique().notNull(),

    // 'pending' | 'accepted' | 'expired' | 'revoked'
    status: text('status', { enum: ['pending', 'accepted', 'expired', 'revoked'] })
      .notNull()
      .default('pending'),

    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('workspace_invitations_workspace_id_idx').on(table.workspaceId),
    index('workspace_invitations_email_idx').on(table.email),
    index('workspace_invitations_token_idx').on(table.token),
    index('workspace_invitations_status_idx').on(table.status),
  ],
);

export type NewWorkspaceInvitation = typeof workspaceInvitations.$inferInsert;
export type WorkspaceInvitationItem = typeof workspaceInvitations.$inferSelect;

// ======= workspace_audit_logs ======= //

export const workspaceAuditLogs = pgTable(
  'workspace_audit_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('workspaceAuditLogs'))
      .notNull(),

    workspaceId: text('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'set null' }),

    // Action identifier, e.g. 'member.invited', 'agent.created', 'provider.updated'
    action: text('action').notNull(),

    // Resource info
    resourceType: text('resource_type'), // 'member', 'agent', 'kb', 'provider', 'settings'
    resourceId: text('resource_id'),

    // Additional context
    metadata: jsonb('metadata').default({}),
    ipAddress: text('ip_address'),

    createdAt: createdAt(),
  },
  (table) => [
    index('workspace_audit_logs_workspace_id_idx').on(table.workspaceId),
    index('workspace_audit_logs_user_id_idx').on(table.userId),
    index('workspace_audit_logs_action_idx').on(table.action),
    index('workspace_audit_logs_resource_type_idx').on(table.resourceType),
    index('workspace_audit_logs_created_at_idx').on(table.createdAt),
  ],
);

export type NewWorkspaceAuditLog = typeof workspaceAuditLogs.$inferInsert;
export type WorkspaceAuditLogItem = typeof workspaceAuditLogs.$inferSelect;
