import type { WorkspaceStore } from './store';

export const workspaceSelectors = {
  activeWorkspace: (s: WorkspaceStore) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null,

  activeWorkspaceId: (s: WorkspaceStore) => s.activeWorkspaceId,

  isAdmin: (s: WorkspaceStore) => s.myRole === 'admin' || s.myRole === 'owner',

  isEditor: (s: WorkspaceStore) =>
    s.myRole === 'editor' || s.myRole === 'admin' || s.myRole === 'owner',

  isLoading: (s: WorkspaceStore) => s.isWorkspaceLoading,

  isOwner: (s: WorkspaceStore) => s.myRole === 'owner',

  isPersonalWorkspace: (s: WorkspaceStore) => {
    const active = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
    return active?.type === 'personal';
  },

  isTeamWorkspace: (s: WorkspaceStore) => {
    const active = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
    return active?.type === 'team';
  },

  members: (s: WorkspaceStore) => s.members,

  myRole: (s: WorkspaceStore) => s.myRole,

  workspaces: (s: WorkspaceStore) => s.workspaces,
};
