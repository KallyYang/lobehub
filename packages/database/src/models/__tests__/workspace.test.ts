// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { users, workspaceInvitations, workspaceMembers, workspaces } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { WorkspaceModel } from '../workspace';

const serverDB: LobeChatDatabase = await getTestDB();

const userId = 'workspace-model-test-user-id';
const userId2 = 'workspace-model-test-user-2';
const workspaceModel = new WorkspaceModel(serverDB, userId);

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }, { id: userId2 }]);
});

afterEach(async () => {
  await serverDB.delete(workspaceInvitations);
  await serverDB.delete(workspaceMembers);
  await serverDB.delete(workspaces);
  await serverDB.delete(users);
});

describe('WorkspaceModel', () => {
  // ======= Workspace CRUD ======= //

  describe('create', () => {
    it('should create a team workspace and add creator as owner', async () => {
      const ws = await workspaceModel.create({ name: 'Test Workspace' });

      expect(ws.id).toBeDefined();
      expect(ws.name).toBe('Test Workspace');
      expect(ws.type).toBe('team');
      expect(ws.ownerId).toBe(userId);

      // Verify owner membership was created
      const member = await serverDB.query.workspaceMembers.findFirst({
        where: eq(workspaceMembers.workspaceId, ws.id),
      });
      expect(member).toBeDefined();
      expect(member!.userId).toBe(userId);
      expect(member!.role).toBe('owner');
    });
  });

  describe('findById', () => {
    it('should find workspace by id', async () => {
      const ws = await workspaceModel.create({ name: 'Find Me' });
      const found = await workspaceModel.findById(ws.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('Find Me');
    });

    it('should return undefined for non-existent id', async () => {
      const found = await workspaceModel.findById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('listUserWorkspaces', () => {
    it('should list all workspaces user belongs to', async () => {
      await workspaceModel.create({ name: 'WS 1' });
      await workspaceModel.create({ name: 'WS 2' });

      const list = await workspaceModel.listUserWorkspaces();
      expect(list).toHaveLength(2);
    });

    it('should not list workspaces user does not belong to', async () => {
      await workspaceModel.create({ name: 'My WS' });

      const user2Model = new WorkspaceModel(serverDB, userId2);
      await user2Model.create({ name: 'Other WS' });

      const myList = await workspaceModel.listUserWorkspaces();
      expect(myList).toHaveLength(1);
      expect(myList[0].name).toBe('My WS');
    });
  });

  describe('update', () => {
    it('should update workspace name and description', async () => {
      const ws = await workspaceModel.create({ name: 'Original' });

      await workspaceModel.update(ws.id, {
        description: 'Updated desc',
        name: 'Updated',
      });

      const updated = await workspaceModel.findById(ws.id);
      expect(updated!.name).toBe('Updated');
      expect(updated!.description).toBe('Updated desc');
    });
  });

  describe('delete', () => {
    it('should delete a team workspace', async () => {
      const ws = await workspaceModel.create({ name: 'To Delete' });
      await workspaceModel.delete(ws.id);

      const found = await workspaceModel.findById(ws.id);
      expect(found).toBeUndefined();
    });

    it('should not delete a personal workspace', async () => {
      // Insert a personal workspace directly
      const [personalWs] = await serverDB
        .insert(workspaces)
        .values({
          name: 'Personal',
          ownerId: userId,
          type: 'personal',
        })
        .returning();

      await workspaceModel.delete(personalWs.id);

      // Should still exist
      const found = await workspaceModel.findById(personalWs.id);
      expect(found).toBeDefined();
    });
  });

  describe('settings', () => {
    it('should get and update workspace settings', async () => {
      const ws = await workspaceModel.create({ name: 'Settings WS' });

      const initialSettings = await workspaceModel.getSettings(ws.id);
      expect(initialSettings).toEqual({});

      await workspaceModel.updateSettings(ws.id, { theme: 'dark' });

      const updatedSettings = await workspaceModel.getSettings(ws.id);
      expect(updatedSettings).toEqual({ theme: 'dark' });
    });
  });

  // ======= Member Management ======= //

  describe('listMembers', () => {
    it('should list workspace members', async () => {
      const ws = await workspaceModel.create({ name: 'Members WS' });

      // Creator is already a member
      const members = await workspaceModel.listMembers(ws.id);
      expect(members).toHaveLength(1);
      expect(members[0].role).toBe('owner');
    });
  });

  describe('addMember', () => {
    it('should add a new member to workspace', async () => {
      const ws = await workspaceModel.create({ name: 'Add Member WS' });

      await workspaceModel.addMember({
        role: 'editor',
        userId: userId2,
        workspaceId: ws.id,
      });

      const members = await workspaceModel.listMembers(ws.id);
      expect(members).toHaveLength(2);

      const newMember = members.find((m) => m.userId === userId2);
      expect(newMember).toBeDefined();
      expect(newMember!.role).toBe('editor');
    });

    it('should not fail on duplicate member (onConflictDoNothing)', async () => {
      const ws = await workspaceModel.create({ name: 'Dup Member WS' });

      // Try to add the same user again (already owner from create)
      const result = await workspaceModel.addMember({
        role: 'member',
        userId,
        workspaceId: ws.id,
      });

      // Should not throw, result may be undefined due to conflict
      const members = await workspaceModel.listMembers(ws.id);
      expect(members).toHaveLength(1); // Still just one
    });
  });

  describe('removeMember', () => {
    it('should remove a member from workspace', async () => {
      const ws = await workspaceModel.create({ name: 'Remove Member WS' });
      await workspaceModel.addMember({
        role: 'member',
        userId: userId2,
        workspaceId: ws.id,
      });

      await workspaceModel.removeMember(ws.id, userId2);

      const members = await workspaceModel.listMembers(ws.id);
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe(userId);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const ws = await workspaceModel.create({ name: 'Role WS' });
      await workspaceModel.addMember({
        role: 'member',
        userId: userId2,
        workspaceId: ws.id,
      });

      await workspaceModel.updateMemberRole(ws.id, userId2, 'admin');

      const member = await workspaceModel.getMember(ws.id, userId2);
      expect(member!.role).toBe('admin');
    });
  });

  // ======= Invitations ======= //

  describe('invitations', () => {
    it('should create and find invitation by token', async () => {
      const ws = await workspaceModel.create({ name: 'Invite WS' });

      const invitation = await workspaceModel.createInvitation({
        email: 'test@example.com',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        role: 'member',
        status: 'pending',
        token: 'test-token-123',
        workspaceId: ws.id,
      });

      expect(invitation.id).toBeDefined();
      expect(invitation.token).toBe('test-token-123');

      const found = await workspaceModel.findInvitationByToken('test-token-123');
      expect(found).toBeDefined();
      expect(found!.email).toBe('test@example.com');
    });

    it('should list pending invitations', async () => {
      const ws = await workspaceModel.create({ name: 'Pending Invite WS' });

      await workspaceModel.createInvitation({
        email: 'a@test.com',
        expiresAt: new Date(Date.now() + 86400000),
        role: 'member',
        status: 'pending',
        token: 'token-a',
        workspaceId: ws.id,
      });
      await workspaceModel.createInvitation({
        email: 'b@test.com',
        expiresAt: new Date(Date.now() + 86400000),
        role: 'editor',
        status: 'pending',
        token: 'token-b',
        workspaceId: ws.id,
      });

      const pending = await workspaceModel.listPendingInvitations(ws.id);
      expect(pending).toHaveLength(2);
    });

    it('should update invitation status', async () => {
      const ws = await workspaceModel.create({ name: 'Status Invite WS' });

      const invitation = await workspaceModel.createInvitation({
        email: 'revoke@test.com',
        expiresAt: new Date(Date.now() + 86400000),
        role: 'member',
        status: 'pending',
        token: 'token-revoke',
        workspaceId: ws.id,
      });

      await workspaceModel.updateInvitationStatus(invitation.id, 'revoked');

      const updated = await workspaceModel.findInvitationByToken('token-revoke');
      expect(updated!.status).toBe('revoked');
    });
  });
});
