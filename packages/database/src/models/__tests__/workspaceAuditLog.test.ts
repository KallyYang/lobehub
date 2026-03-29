// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { users, workspaceAuditLogs, workspaceMembers, workspaces } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { WorkspaceAuditLogModel, auditLog } from '../workspaceAuditLog';
import { WorkspaceModel } from '../workspace';

const serverDB: LobeChatDatabase = await getTestDB();

const userId = 'audit-log-test-user';
let workspaceId: string;

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }]);

  const wsModel = new WorkspaceModel(serverDB, userId);
  const ws = await wsModel.create({ name: 'Audit Test WS' });
  workspaceId = ws.id;
});

afterEach(async () => {
  await serverDB.delete(workspaceAuditLogs);
  await serverDB.delete(workspaceMembers);
  await serverDB.delete(workspaces);
  await serverDB.delete(users);
});

describe('WorkspaceAuditLogModel', () => {
  describe('log', () => {
    it('should create an audit log entry', async () => {
      const model = new WorkspaceAuditLogModel(serverDB);

      const entry = await model.log({
        action: 'member.invited',
        metadata: { email: 'test@example.com' },
        resourceId: 'user-123',
        resourceType: 'member',
        userId,
        workspaceId,
      });

      expect(entry.id).toBeDefined();
      expect(entry.action).toBe('member.invited');
      expect(entry.workspaceId).toBe(workspaceId);
    });
  });

  describe('query', () => {
    it('should query audit logs for a workspace', async () => {
      const model = new WorkspaceAuditLogModel(serverDB);

      await model.log({ action: 'agent.created', resourceType: 'agent', userId, workspaceId });
      await model.log({ action: 'member.invited', resourceType: 'member', userId, workspaceId });
      await model.log({ action: 'agent.deleted', resourceType: 'agent', userId, workspaceId });

      const allLogs = await model.query({ workspaceId });
      expect(allLogs).toHaveLength(3);

      // Filter by action
      const agentLogs = await model.query({ action: 'agent.created', workspaceId });
      expect(agentLogs).toHaveLength(1);

      // Filter by resourceType
      const memberLogs = await model.query({ resourceType: 'member', workspaceId });
      expect(memberLogs).toHaveLength(1);
    });

    it('should respect limit and offset', async () => {
      const model = new WorkspaceAuditLogModel(serverDB);

      for (let i = 0; i < 5; i++) {
        await model.log({ action: `action-${i}`, userId, workspaceId });
      }

      const first2 = await model.query({ limit: 2, workspaceId });
      expect(first2).toHaveLength(2);

      const offset2 = await model.query({ limit: 2, offset: 2, workspaceId });
      expect(offset2).toHaveLength(2);
    });
  });
});

describe('auditLog helper', () => {
  it('should not throw even if db operation fails', async () => {
    // Pass an invalid workspace ID — should not throw
    await expect(
      auditLog(serverDB, {
        action: 'test.action',
        userId,
        workspaceId: 'nonexistent-ws',
      }),
    ).resolves.toBeUndefined();
  });
});
