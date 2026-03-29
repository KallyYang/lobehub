import { describe, expect, it } from 'vitest';

import type { WorkspaceState } from './initialState';
import { workspaceSelectors } from './selectors';

const makeState = (overrides: Partial<WorkspaceState> = {}): WorkspaceState => ({
  activeWorkspaceId: null,
  isWorkspaceLoading: false,
  members: [],
  myRole: 'owner',
  workspaces: [],
  ...overrides,
});

describe('workspaceSelectors', () => {
  describe('activeWorkspace', () => {
    it('should return the active workspace', () => {
      const state = makeState({
        activeWorkspaceId: 'ws1',
        workspaces: [
          { id: 'ws1', name: 'Team A', slug: 'team-a', type: 'team' },
          { id: 'ws2', name: 'Personal', slug: 'personal', type: 'personal' },
        ],
      });

      const result = workspaceSelectors.activeWorkspace(state);
      expect(result).toEqual({ id: 'ws1', name: 'Team A', slug: 'team-a', type: 'team' });
    });

    it('should return null when no active workspace', () => {
      const state = makeState({ activeWorkspaceId: null });
      expect(workspaceSelectors.activeWorkspace(state)).toBeNull();
    });

    it('should return null when active ID does not match any workspace', () => {
      const state = makeState({
        activeWorkspaceId: 'nonexistent',
        workspaces: [{ id: 'ws1', name: 'WS', slug: 'ws', type: 'team' }],
      });
      expect(workspaceSelectors.activeWorkspace(state)).toBeNull();
    });
  });

  describe('isTeamWorkspace / isPersonalWorkspace', () => {
    it('should detect team workspace', () => {
      const state = makeState({
        activeWorkspaceId: 'ws1',
        workspaces: [{ id: 'ws1', name: 'Team', slug: 'team', type: 'team' }],
      });
      expect(workspaceSelectors.isTeamWorkspace(state)).toBe(true);
      expect(workspaceSelectors.isPersonalWorkspace(state)).toBe(false);
    });

    it('should detect personal workspace', () => {
      const state = makeState({
        activeWorkspaceId: 'ws1',
        workspaces: [{ id: 'ws1', name: 'Personal', slug: 'p', type: 'personal' }],
      });
      expect(workspaceSelectors.isTeamWorkspace(state)).toBe(false);
      expect(workspaceSelectors.isPersonalWorkspace(state)).toBe(true);
    });
  });

  describe('role checks', () => {
    it('isOwner', () => {
      expect(workspaceSelectors.isOwner(makeState({ myRole: 'owner' }))).toBe(true);
      expect(workspaceSelectors.isOwner(makeState({ myRole: 'admin' }))).toBe(false);
    });

    it('isAdmin (admin+)', () => {
      expect(workspaceSelectors.isAdmin(makeState({ myRole: 'owner' }))).toBe(true);
      expect(workspaceSelectors.isAdmin(makeState({ myRole: 'admin' }))).toBe(true);
      expect(workspaceSelectors.isAdmin(makeState({ myRole: 'editor' }))).toBe(false);
      expect(workspaceSelectors.isAdmin(makeState({ myRole: 'member' }))).toBe(false);
    });

    it('isEditor (editor+)', () => {
      expect(workspaceSelectors.isEditor(makeState({ myRole: 'owner' }))).toBe(true);
      expect(workspaceSelectors.isEditor(makeState({ myRole: 'admin' }))).toBe(true);
      expect(workspaceSelectors.isEditor(makeState({ myRole: 'editor' }))).toBe(true);
      expect(workspaceSelectors.isEditor(makeState({ myRole: 'member' }))).toBe(false);
    });
  });

  describe('permission selectors', () => {
    it('canManageMembers requires admin+', () => {
      expect(workspaceSelectors.canManageMembers(makeState({ myRole: 'admin' }))).toBe(true);
      expect(workspaceSelectors.canManageMembers(makeState({ myRole: 'editor' }))).toBe(false);
    });

    it('canEditResources requires editor+', () => {
      expect(workspaceSelectors.canEditResources(makeState({ myRole: 'editor' }))).toBe(true);
      expect(workspaceSelectors.canEditResources(makeState({ myRole: 'member' }))).toBe(false);
    });

    it('canDeleteWorkspace requires owner + team workspace', () => {
      const teamOwner = makeState({
        activeWorkspaceId: 'ws1',
        myRole: 'owner',
        workspaces: [{ id: 'ws1', name: 'T', slug: 't', type: 'team' }],
      });
      expect(workspaceSelectors.canDeleteWorkspace(teamOwner)).toBe(true);

      const personalOwner = makeState({
        activeWorkspaceId: 'ws1',
        myRole: 'owner',
        workspaces: [{ id: 'ws1', name: 'P', slug: 'p', type: 'personal' }],
      });
      expect(workspaceSelectors.canDeleteWorkspace(personalOwner)).toBe(false);

      const teamAdmin = makeState({
        activeWorkspaceId: 'ws1',
        myRole: 'admin',
        workspaces: [{ id: 'ws1', name: 'T', slug: 't', type: 'team' }],
      });
      expect(workspaceSelectors.canDeleteWorkspace(teamAdmin)).toBe(false);
    });

    it('canManageWorkspace requires admin+', () => {
      expect(workspaceSelectors.canManageWorkspace(makeState({ myRole: 'owner' }))).toBe(true);
      expect(workspaceSelectors.canManageWorkspace(makeState({ myRole: 'admin' }))).toBe(true);
      expect(workspaceSelectors.canManageWorkspace(makeState({ myRole: 'editor' }))).toBe(false);
    });
  });

  describe('basic selectors', () => {
    it('workspaces returns the list', () => {
      const ws = [{ id: 'ws1', name: 'WS', slug: 'ws', type: 'team' as const }];
      expect(workspaceSelectors.workspaces(makeState({ workspaces: ws }))).toEqual(ws);
    });

    it('members returns the list', () => {
      const m = [{ joinedAt: '2024-01-01', role: 'owner' as const, userId: 'u1', workspaceId: 'ws1' }];
      expect(workspaceSelectors.members(makeState({ members: m }))).toEqual(m);
    });

    it('isLoading returns loading state', () => {
      expect(workspaceSelectors.isLoading(makeState({ isWorkspaceLoading: true }))).toBe(true);
      expect(workspaceSelectors.isLoading(makeState({ isWorkspaceLoading: false }))).toBe(false);
    });
  });
});
