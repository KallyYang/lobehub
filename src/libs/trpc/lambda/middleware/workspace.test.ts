import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type AuthContext, createContextInner } from '@/libs/trpc/lambda/context';
import { createCallerFactory } from '@/libs/trpc/lambda';

import { trpc } from '../init';
import { hasMinRole, requireWorkspaceRole, workspaceAuth } from './workspace';

// Mock getServerDB
vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

// Mock schema imports
vi.mock('@/database/schemas', () => ({
  workspaceMembers: { role: 'role', userId: 'user_id', workspaceId: 'workspace_id' },
  workspaces: { id: 'id', ownerId: 'owner_id', type: 'type' },
}));

describe('hasMinRole', () => {
  it('owner >= all roles', () => {
    expect(hasMinRole('owner', 'owner')).toBe(true);
    expect(hasMinRole('owner', 'admin')).toBe(true);
    expect(hasMinRole('owner', 'editor')).toBe(true);
    expect(hasMinRole('owner', 'member')).toBe(true);
  });

  it('admin >= admin, editor, member but not owner', () => {
    expect(hasMinRole('admin', 'owner')).toBe(false);
    expect(hasMinRole('admin', 'admin')).toBe(true);
    expect(hasMinRole('admin', 'editor')).toBe(true);
    expect(hasMinRole('admin', 'member')).toBe(true);
  });

  it('editor >= editor, member but not admin/owner', () => {
    expect(hasMinRole('editor', 'owner')).toBe(false);
    expect(hasMinRole('editor', 'admin')).toBe(false);
    expect(hasMinRole('editor', 'editor')).toBe(true);
    expect(hasMinRole('editor', 'member')).toBe(true);
  });

  it('member >= member only', () => {
    expect(hasMinRole('member', 'owner')).toBe(false);
    expect(hasMinRole('member', 'admin')).toBe(false);
    expect(hasMinRole('member', 'editor')).toBe(false);
    expect(hasMinRole('member', 'member')).toBe(true);
  });
});

describe('requireWorkspaceRole', () => {
  const appRouter = trpc.router({
    adminOnly: trpc.procedure
      .use(async (opts) =>
        opts.next({ ctx: { userId: 'u1', workspaceId: 'ws1', workspaceRole: 'admin' as const } }),
      )
      .use(requireWorkspaceRole('admin'))
      .query(() => 'ok'),

    memberTryAdmin: trpc.procedure
      .use(async (opts) =>
        opts.next({ ctx: { userId: 'u1', workspaceId: 'ws1', workspaceRole: 'member' as const } }),
      )
      .use(requireWorkspaceRole('admin'))
      .query(() => 'ok'),
  });

  const createCaller = createCallerFactory(appRouter);

  it('should allow admin to access admin-gated procedure', async () => {
    const ctx = await createContextInner({ userId: 'u1', workspaceId: 'ws1' });
    const caller = createCaller(ctx);
    const result = await caller.adminOnly();
    expect(result).toBe('ok');
  });

  it('should deny member from admin-gated procedure', async () => {
    const ctx = await createContextInner({ userId: 'u1', workspaceId: 'ws1' });
    const caller = createCaller(ctx);

    await expect(caller.memberTryAdmin()).rejects.toThrow(TRPCError);
  });
});
