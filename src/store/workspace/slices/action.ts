'use client';

import type { WorkspaceRole } from '@/server/utils/workspacePermissions';
import { type StoreSetter } from '@/store/types';
import { setNamespace } from '@/utils/storeDebug';

import type { WorkspaceStore } from '../store';

const n = setNamespace('workspace');

const WORKSPACE_STORAGE_KEY = 'lobe-workspace-active-id';

type Setter = StoreSetter<WorkspaceStore>;

export const createWorkspaceSlice = (set: Setter, get: () => WorkspaceStore, _api?: unknown) =>
  new WorkspaceActionImpl(set, get, _api);

export class WorkspaceActionImpl {
  readonly #get: () => WorkspaceStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => WorkspaceStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  switchWorkspace = (id: string) => {
    this.#set({ activeWorkspaceId: id }, false, n('switchWorkspace'));

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
    }
  };

  restoreActiveWorkspace = () => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (stored) {
      this.#set({ activeWorkspaceId: stored }, false, n('restoreActiveWorkspace'));
    }
  };

  setWorkspaces = (workspaces: WorkspaceStore['workspaces']) => {
    this.#set({ workspaces }, false, n('setWorkspaces'));

    // If no active workspace but we have workspaces, set the first one
    const state = this.#get();
    if (!state.activeWorkspaceId && workspaces.length > 0) {
      const personal = workspaces.find((w) => w.type === 'personal');
      if (personal) {
        this.switchWorkspace(personal.id);
      }
    }
  };

  setMembers = (members: WorkspaceStore['members']) => {
    this.#set({ members }, false, n('setMembers'));
  };

  setMyRole = (role: WorkspaceRole | null) => {
    this.#set({ myRole: role }, false, n('setMyRole'));
  };

  setWorkspaceLoading = (loading: boolean) => {
    this.#set({ isWorkspaceLoading: loading }, false, n('setWorkspaceLoading'));
  };
}

export type WorkspaceAction = Pick<WorkspaceActionImpl, keyof WorkspaceActionImpl>;
