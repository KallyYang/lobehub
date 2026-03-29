import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import { getServerDB } from '@/database/core/db-adaptor';
import { workspaceMembers, workspaces } from '@/database/schemas';
import {
  type WorkspaceRole,
  hasMinRole,
} from '@/server/utils/workspacePermissions';

import { trpc } from '../init';

/**
 * Workspace authentication middleware.
 * Validates that the user is a member of the requested workspace
 * and injects workspaceId + workspaceRole into the context.
 *
 * If no workspaceId is provided, passes through without workspace context.
 * Cloud repo will override this middleware to query cloudDB instead of serverDB.
 */
export const workspaceAuth = trpc.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.workspaceId) {
    return next({
      ctx: {
        workspaceId: undefined as string | undefined,
        workspaceRole: undefined as WorkspaceRole | undefined,
      },
    });
  }

  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const db = await getServerDB();

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, ctx.workspaceId),
  });

  if (!workspace) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Workspace not found',
    });
  }

  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, ctx.workspaceId),
      eq(workspaceMembers.userId, ctx.userId),
    ),
  });

  if (!membership) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Not a member of this workspace',
    });
  }

  return next({
    ctx: {
      workspaceId: ctx.workspaceId,
      workspaceRole: membership.role as WorkspaceRole,
    },
  });
});

/**
 * Factory middleware that requires a minimum workspace role.
 */
export const requireWorkspaceRole = (minRole: WorkspaceRole) =>
  trpc.middleware(async (opts) => {
    const { ctx, next } = opts;

    const role = (ctx as any).workspaceRole as WorkspaceRole | undefined;

    if (!role) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Workspace context required',
      });
    }

    if (!hasMinRole(role, minRole)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Requires ${minRole} role or higher`,
      });
    }

    return next();
  });
