'use client';

import type { WorkspaceItem, WorkspaceMemberItem } from '@lobechat/database/schemas';

import type { WorkspaceRole } from '@/server/utils/workspacePermissions';

export interface WorkspaceState {
  activeWorkspaceId: string | null;
  isWorkspaceLoading: boolean;
  members: WorkspaceMemberItem[];
  myRole: WorkspaceRole | null;
  workspaces: (WorkspaceItem & { role?: string })[];
}

export const initialWorkspaceState: WorkspaceState = {
  activeWorkspaceId: null,
  isWorkspaceLoading: false,
  members: [],
  myRole: null,
  workspaces: [],
};
