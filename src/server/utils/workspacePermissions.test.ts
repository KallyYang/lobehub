import { describe, expect, it } from 'vitest';

import {
  canDeleteWorkspace,
  canEditResources,
  canManageBilling,
  canManageMembers,
  canManageWorkspace,
  getPermissions,
  hasPermission,
} from './workspacePermissions';

describe('workspacePermissions', () => {
  describe('hasPermission', () => {
    // Owner has all permissions
    it('owner should have all permissions', () => {
      expect(hasPermission('owner', 'workspace:manage')).toBe(true);
      expect(hasPermission('owner', 'workspace:delete')).toBe(true);
      expect(hasPermission('owner', 'workspace:billing')).toBe(true);
      expect(hasPermission('owner', 'workspace:members:invite')).toBe(true);
      expect(hasPermission('owner', 'workspace:agent:create')).toBe(true);
      expect(hasPermission('owner', 'workspace:kb:delete')).toBe(true);
      expect(hasPermission('owner', 'workspace:provider:manage')).toBe(true);
    });

    // Admin has most but not delete/billing
    it('admin should have management but not delete/billing', () => {
      expect(hasPermission('admin', 'workspace:manage')).toBe(true);
      expect(hasPermission('admin', 'workspace:delete')).toBe(false);
      expect(hasPermission('admin', 'workspace:billing')).toBe(false);
      expect(hasPermission('admin', 'workspace:members:invite')).toBe(true);
      expect(hasPermission('admin', 'workspace:agent:create')).toBe(true);
      expect(hasPermission('admin', 'workspace:provider:manage')).toBe(true);
    });

    // Editor has resource CRUD but no management
    it('editor should have resource CRUD but no workspace management', () => {
      expect(hasPermission('editor', 'workspace:manage')).toBe(false);
      expect(hasPermission('editor', 'workspace:members:invite')).toBe(false);
      expect(hasPermission('editor', 'workspace:agent:create')).toBe(true);
      expect(hasPermission('editor', 'workspace:agent:read')).toBe(true);
      expect(hasPermission('editor', 'workspace:kb:create')).toBe(true);
      expect(hasPermission('editor', 'workspace:session:create')).toBe(true);
    });

    // Member has read + session create only
    it('member should have read access and session create', () => {
      expect(hasPermission('member', 'workspace:agent:read')).toBe(true);
      expect(hasPermission('member', 'workspace:kb:read')).toBe(true);
      expect(hasPermission('member', 'workspace:session:create')).toBe(true);
      expect(hasPermission('member', 'workspace:agent:create')).toBe(false);
      expect(hasPermission('member', 'workspace:manage')).toBe(false);
      expect(hasPermission('member', 'workspace:members:invite')).toBe(false);
    });
  });

  describe('getPermissions', () => {
    it('owner should have more permissions than admin', () => {
      const ownerPerms = getPermissions('owner');
      const adminPerms = getPermissions('admin');
      expect(ownerPerms.length).toBeGreaterThan(adminPerms.length);
    });

    it('admin should have more permissions than editor', () => {
      const adminPerms = getPermissions('admin');
      const editorPerms = getPermissions('editor');
      expect(adminPerms.length).toBeGreaterThan(editorPerms.length);
    });

    it('editor should have more permissions than member', () => {
      const editorPerms = getPermissions('editor');
      const memberPerms = getPermissions('member');
      expect(editorPerms.length).toBeGreaterThan(memberPerms.length);
    });
  });

  describe('convenience checks', () => {
    it('canManageWorkspace', () => {
      expect(canManageWorkspace('owner')).toBe(true);
      expect(canManageWorkspace('admin')).toBe(true);
      expect(canManageWorkspace('editor')).toBe(false);
      expect(canManageWorkspace('member')).toBe(false);
    });

    it('canManageMembers', () => {
      expect(canManageMembers('owner')).toBe(true);
      expect(canManageMembers('admin')).toBe(true);
      expect(canManageMembers('editor')).toBe(false);
    });

    it('canEditResources', () => {
      expect(canEditResources('owner')).toBe(true);
      expect(canEditResources('admin')).toBe(true);
      expect(canEditResources('editor')).toBe(true);
      expect(canEditResources('member')).toBe(false);
    });

    it('canDeleteWorkspace', () => {
      expect(canDeleteWorkspace('owner')).toBe(true);
      expect(canDeleteWorkspace('admin')).toBe(false);
      expect(canDeleteWorkspace('editor')).toBe(false);
    });

    it('canManageBilling', () => {
      expect(canManageBilling('owner')).toBe(true);
      expect(canManageBilling('admin')).toBe(false);
    });
  });
});
