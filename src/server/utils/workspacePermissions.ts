import type { WorkspaceRole } from '@/libs/trpc/lambda/middleware/workspace';
import { hasMinRole } from '@/libs/trpc/lambda/middleware/workspace';

/**
 * Workspace permission codes — organized by resource category
 */
export const WorkspacePermission = {
  // Workspace management
  'workspace:manage': 'workspace:manage',
  'workspace:delete': 'workspace:delete',

  // Member management
  'workspace:members:invite': 'workspace:members:invite',
  'workspace:members:remove': 'workspace:members:remove',
  'workspace:members:role': 'workspace:members:role',

  // Billing
  'workspace:billing': 'workspace:billing',

  // Agent CRUD
  'workspace:agent:create': 'workspace:agent:create',
  'workspace:agent:read': 'workspace:agent:read',
  'workspace:agent:update': 'workspace:agent:update',
  'workspace:agent:delete': 'workspace:agent:delete',

  // Knowledge Base CRUD
  'workspace:kb:create': 'workspace:kb:create',
  'workspace:kb:read': 'workspace:kb:read',
  'workspace:kb:update': 'workspace:kb:update',
  'workspace:kb:delete': 'workspace:kb:delete',

  // AI Provider config
  'workspace:provider:manage': 'workspace:provider:manage',

  // API Key management
  'workspace:apikey:manage': 'workspace:apikey:manage',

  // Session/Chat (user-level but within workspace context)
  'workspace:session:create': 'workspace:session:create',
  'workspace:session:read': 'workspace:session:read',
} as const;

export type WorkspacePermissionCode = keyof typeof WorkspacePermission;

/**
 * Role → Permission mapping
 * Defines which permissions each role has
 */
const ROLE_PERMISSIONS: Record<WorkspaceRole, Set<WorkspacePermissionCode>> = {
  owner: new Set([
    // All permissions
    'workspace:manage',
    'workspace:delete',
    'workspace:members:invite',
    'workspace:members:remove',
    'workspace:members:role',
    'workspace:billing',
    'workspace:agent:create',
    'workspace:agent:read',
    'workspace:agent:update',
    'workspace:agent:delete',
    'workspace:kb:create',
    'workspace:kb:read',
    'workspace:kb:update',
    'workspace:kb:delete',
    'workspace:provider:manage',
    'workspace:apikey:manage',
    'workspace:session:create',
    'workspace:session:read',
  ]),

  admin: new Set([
    'workspace:manage',
    'workspace:members:invite',
    'workspace:members:remove',
    'workspace:agent:create',
    'workspace:agent:read',
    'workspace:agent:update',
    'workspace:agent:delete',
    'workspace:kb:create',
    'workspace:kb:read',
    'workspace:kb:update',
    'workspace:kb:delete',
    'workspace:provider:manage',
    'workspace:apikey:manage',
    'workspace:session:create',
    'workspace:session:read',
  ]),

  editor: new Set([
    'workspace:agent:create',
    'workspace:agent:read',
    'workspace:agent:update',
    'workspace:agent:delete',
    'workspace:kb:create',
    'workspace:kb:read',
    'workspace:kb:update',
    'workspace:kb:delete',
    'workspace:session:create',
    'workspace:session:read',
  ]),

  member: new Set([
    'workspace:agent:read',
    'workspace:kb:read',
    'workspace:session:create',
    'workspace:session:read',
  ]),
};

/**
 * Check if a workspace role has a specific permission
 */
export const hasPermission = (
  role: WorkspaceRole,
  permission: WorkspacePermissionCode,
): boolean => {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
};

/**
 * Get all permissions for a given role
 */
export const getPermissions = (role: WorkspaceRole): WorkspacePermissionCode[] => {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
};

/**
 * Quick role-level checks for common use cases
 */
export const canManageWorkspace = (role: WorkspaceRole) => hasMinRole(role, 'admin');
export const canManageMembers = (role: WorkspaceRole) => hasMinRole(role, 'admin');
export const canEditResources = (role: WorkspaceRole) => hasMinRole(role, 'editor');
export const canDeleteWorkspace = (role: WorkspaceRole) => role === 'owner';
export const canManageBilling = (role: WorkspaceRole) => role === 'owner';
