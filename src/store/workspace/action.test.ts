import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceStore } from './store';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    clear: () => {
      store = {};
    },
    getItem: (key: string) => store[key] || null,
    removeItem: (key: string) => {
      delete store[key];
    },
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  // Reset store to initial state
  useWorkspaceStore.setState({
    activeWorkspaceId: null,
    isWorkspaceLoading: false,
    members: [],
    myRole: 'owner',
    workspaces: [],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Workspace Store Actions', () => {
  describe('switchWorkspace', () => {
    it('should switch active workspace and persist to localStorage', () => {
      useWorkspaceStore.setState({
        workspaces: [
          { id: 'ws1', name: 'WS1', slug: 'ws1', type: 'team' },
          { id: 'ws2', name: 'WS2', slug: 'ws2', type: 'personal' },
        ],
      });

      useWorkspaceStore.getState().switchWorkspace('ws2');

      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('ws2');
      expect(localStorageMock.getItem('lobe-active-workspace-id')).toBe('ws2');
    });

    it('should not switch to non-existent workspace', () => {
      useWorkspaceStore.setState({
        activeWorkspaceId: 'ws1',
        workspaces: [{ id: 'ws1', name: 'WS1', slug: 'ws1', type: 'team' }],
      });

      useWorkspaceStore.getState().switchWorkspace('nonexistent');

      // Should remain unchanged
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('ws1');
    });

    it('should set myRole to owner for personal workspace', () => {
      useWorkspaceStore.setState({
        members: [],
        workspaces: [{ id: 'ws1', name: 'Personal', slug: 'p', type: 'personal' }],
      });

      useWorkspaceStore.getState().switchWorkspace('ws1');

      expect(useWorkspaceStore.getState().myRole).toBe('owner');
    });
  });

  describe('_restoreActiveWorkspace', () => {
    it('should restore workspace ID from localStorage', () => {
      localStorageMock.setItem('lobe-active-workspace-id', 'ws-saved');

      useWorkspaceStore.getState()._restoreActiveWorkspace();

      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('ws-saved');
    });

    it('should not change state if localStorage is empty', () => {
      useWorkspaceStore.setState({ activeWorkspaceId: 'current' });

      useWorkspaceStore.getState()._restoreActiveWorkspace();

      // No localStorage value, should remain null (the set would set null)
      // Actually _restoreActiveWorkspace only sets if there's a saved value
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('current');
    });
  });

  describe('deleteWorkspace', () => {
    it('should remove workspace from list', async () => {
      useWorkspaceStore.setState({
        activeWorkspaceId: 'ws2',
        workspaces: [
          { id: 'ws1', name: 'Personal', slug: 'p', type: 'personal' },
          { id: 'ws2', name: 'Team', slug: 't', type: 'team' },
        ],
      });

      await useWorkspaceStore.getState().deleteWorkspace('ws2');

      expect(useWorkspaceStore.getState().workspaces).toHaveLength(1);
      expect(useWorkspaceStore.getState().workspaces[0].id).toBe('ws1');
    });

    it('should switch to personal workspace when deleting active workspace', async () => {
      useWorkspaceStore.setState({
        activeWorkspaceId: 'ws2',
        workspaces: [
          { id: 'ws1', name: 'Personal', slug: 'p', type: 'personal' },
          { id: 'ws2', name: 'Team', slug: 't', type: 'team' },
        ],
      });

      await useWorkspaceStore.getState().deleteWorkspace('ws2');

      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('ws1');
    });
  });

  describe('updateWorkspace', () => {
    it('should update the active workspace in the list', async () => {
      useWorkspaceStore.setState({
        activeWorkspaceId: 'ws1',
        workspaces: [{ id: 'ws1', name: 'Old Name', slug: 'old', type: 'team' }],
      });

      await useWorkspaceStore.getState().updateWorkspace({ name: 'New Name' });

      const ws = useWorkspaceStore.getState().workspaces[0];
      expect(ws.name).toBe('New Name');
    });
  });

  describe('removeMember', () => {
    it('should remove member from the members list', async () => {
      useWorkspaceStore.setState({
        activeWorkspaceId: 'ws1',
        members: [
          { joinedAt: '2024-01-01', role: 'owner', userId: 'u1', workspaceId: 'ws1' },
          { joinedAt: '2024-01-02', role: 'member', userId: 'u2', workspaceId: 'ws1' },
        ],
      });

      await useWorkspaceStore.getState().removeMember('u2');

      expect(useWorkspaceStore.getState().members).toHaveLength(1);
      expect(useWorkspaceStore.getState().members[0].userId).toBe('u1');
    });
  });
});
