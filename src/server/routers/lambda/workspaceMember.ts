import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { WorkspaceMemberModel } from '@/database/models/workspaceMember';
import { authedProcedure, router, workspaceAdminProcedure, workspaceOwnerProcedure, workspaceProcedure } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { type WorkspaceRole, canChangeRole, canRemoveMember } from '@/server/utils/workspacePermissions';

const memberProcedure = workspaceProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: { memberModel: new WorkspaceMemberModel(ctx.serverDB, ctx.userId) },
  });
});

const adminMemberProcedure = workspaceAdminProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: { memberModel: new WorkspaceMemberModel(ctx.serverDB, ctx.userId) },
  });
});

const ownerMemberProcedure = workspaceOwnerProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: { memberModel: new WorkspaceMemberModel(ctx.serverDB, ctx.userId) },
  });
});

const acceptInviteProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: { memberModel: new WorkspaceMemberModel(ctx.serverDB, ctx.userId) },
  });
});

export const workspaceMemberRouter = router({
  acceptInvite: acceptInviteProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const invitation = await ctx.memberModel.findInvitationByToken(input.token);

      if (!invitation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found' });
      }

      if (invitation.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation is no longer valid' });
      }

      if (new Date() > invitation.expiresAt) {
        await ctx.memberModel.updateInvitationStatus(invitation.id, 'expired');
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation has expired' });
      }

      // Add user as member and mark invitation as accepted
      await ctx.memberModel.addMember({
        role: invitation.role as 'admin' | 'editor' | 'member',
        userId: ctx.userId,
        workspaceId: invitation.workspaceId,
      });

      await ctx.memberModel.updateInvitationStatus(invitation.id, 'accepted');

      return { workspaceId: invitation.workspaceId };
    }),

  invite: adminMemberProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        role: z.enum(['admin', 'editor', 'member']).default('member'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.workspaceId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Workspace context required' });
      }

      return ctx.memberModel.createInvitation({
        email: input.email,
        role: input.role,
        workspaceId: ctx.workspaceId,
      });
    }),

  leave: memberProcedure.mutation(async ({ ctx }) => {
    if (!ctx.workspaceId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Workspace context required' });
    }

    if (ctx.workspaceRole === 'owner') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner cannot leave the workspace' });
    }

    return ctx.memberModel.removeMember(ctx.workspaceId, ctx.userId);
  }),

  list: memberProcedure.query(async ({ ctx }) => {
    if (!ctx.workspaceId) return [];
    return ctx.memberModel.listMembers(ctx.workspaceId);
  }),

  listInvitations: adminMemberProcedure.query(async ({ ctx }) => {
    if (!ctx.workspaceId) return [];
    return ctx.memberModel.listPendingInvitations(ctx.workspaceId);
  }),

  remove: adminMemberProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.workspaceId || !ctx.workspaceRole) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Workspace context required' });
      }

      const target = await ctx.memberModel.getMember(ctx.workspaceId, input.userId);
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      if (!canRemoveMember(ctx.workspaceRole, target.role as WorkspaceRole)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot remove this member' });
      }

      return ctx.memberModel.removeMember(ctx.workspaceId, input.userId);
    }),

  revokeInvitation: adminMemberProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.memberModel.revokeInvitation(input.id);
    }),

  updateRole: ownerMemberProcedure
    .input(
      z.object({
        role: z.enum(['admin', 'editor', 'member']),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.workspaceId || !ctx.workspaceRole) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Workspace context required' });
      }

      const target = await ctx.memberModel.getMember(ctx.workspaceId, input.userId);
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      if (!canChangeRole(ctx.workspaceRole, target.role as WorkspaceRole, input.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot change this role' });
      }

      return ctx.memberModel.updateMemberRole(ctx.workspaceId, input.userId, input.role);
    }),
});

export type WorkspaceMemberRouter = typeof workspaceMemberRouter;
