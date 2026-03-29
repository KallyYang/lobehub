// Workspace role hierarchy levels (higher = more permissions)
export const WorkspaceRoleLevels = {
  member: 0,
  editor: 1,
  admin: 2,
  owner: 3,
} as const;

export type WorkspaceRole = keyof typeof WorkspaceRoleLevels;

// Permission matrix: maps each permission to the minimum required role
export const WorkspacePermissions = {
  'audit:read': 'admin',
  'members:invite': 'admin',
  'members:read': 'member',
  'members:remove': 'admin',
  'members:updateRole': 'admin',
  'resources:create': 'editor',
  'resources:delete': 'editor',
  'resources:read': 'member',
  'resources:update': 'editor',
  'workspace:billing': 'owner',
  'workspace:delete': 'owner',
  'workspace:read': 'member',
  'workspace:update': 'admin',
} as const;

export type WorkspacePermission = keyof typeof WorkspacePermissions;

/**
 * Get the numeric level of a workspace role.
 */
export const getRoleLevel = (role: WorkspaceRole): number => WorkspaceRoleLevels[role];

/**
 * Check if a user's role meets or exceeds a minimum required role.
 */
export const hasMinRole = (userRole: WorkspaceRole, requiredRole: WorkspaceRole): boolean =>
  getRoleLevel(userRole) >= getRoleLevel(requiredRole);

/**
 * Check if a user's role has a specific permission.
 */
export const hasPermission = (userRole: WorkspaceRole, permission: WorkspacePermission): boolean =>
  hasMinRole(userRole, WorkspacePermissions[permission] as WorkspaceRole);

/**
 * Check if a user can manage workspace members (invite, remove, change roles).
 */
export const canManageMembers = (role: WorkspaceRole): boolean => hasMinRole(role, 'admin');

/**
 * Check if a user can create/edit/delete shared resources (agents, KBs, etc.).
 */
export const canEditResources = (role: WorkspaceRole): boolean => hasMinRole(role, 'editor');

/**
 * Check if a user can update workspace settings.
 */
export const canEditWorkspaceSettings = (role: WorkspaceRole): boolean =>
  hasMinRole(role, 'admin');

/**
 * Check if a user can delete the workspace.
 */
export const canDeleteWorkspace = (role: WorkspaceRole): boolean => hasMinRole(role, 'owner');

/**
 * Check if a user can remove a target member.
 * Rules: can only remove members with a lower role level; owners cannot be removed.
 */
export const canRemoveMember = (
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
): boolean => {
  if (targetRole === 'owner') return false;
  return hasMinRole(actorRole, 'admin') && getRoleLevel(actorRole) > getRoleLevel(targetRole);
};

/**
 * Check if a user can change a target member's role.
 * Rules: can only change roles of members with a lower level, and cannot promote beyond own level.
 */
export const canChangeRole = (
  actorRole: WorkspaceRole,
  targetCurrentRole: WorkspaceRole,
  newRole: WorkspaceRole,
): boolean => {
  if (targetCurrentRole === 'owner') return false;
  if (newRole === 'owner') return false;
  return (
    hasMinRole(actorRole, 'admin') &&
    getRoleLevel(actorRole) > getRoleLevel(targetCurrentRole) &&
    getRoleLevel(actorRole) > getRoleLevel(newRole)
  );
};
