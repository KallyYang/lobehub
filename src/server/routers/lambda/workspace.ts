import { z } from 'zod';

import { WorkspaceModel } from '@/database/models/workspace';
import { authedProcedure, router, workspaceAdminProcedure, workspaceOwnerProcedure, workspaceProcedure } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const wsAuthedProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: { workspaceModel: new WorkspaceModel(ctx.serverDB, ctx.userId) },
  });
});

const wsProcedure = workspaceProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: { workspaceModel: new WorkspaceModel(ctx.serverDB, ctx.userId) },
  });
});

const wsAdminProcedure = workspaceAdminProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: { workspaceModel: new WorkspaceModel(ctx.serverDB, ctx.userId) },
  });
});

const wsOwnerProcedure = workspaceOwnerProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: { workspaceModel: new WorkspaceModel(ctx.serverDB, ctx.userId) },
  });
});

export const workspaceRouter = router({
  create: wsAuthedProcedure
    .input(
      z.object({
        avatar: z.string().optional(),
        description: z.string().max(1000).optional(),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.workspaceModel.create(input);
    }),

  delete: wsOwnerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.workspaceModel.delete(input.id);
    }),

  getById: wsProcedure.query(async ({ ctx }) => {
    if (!ctx.workspaceId) return null;
    return ctx.workspaceModel.findById(ctx.workspaceId);
  }),

  getSettings: wsProcedure.query(async ({ ctx }) => {
    if (!ctx.workspaceId) return {};
    return ctx.workspaceModel.getSettings(ctx.workspaceId);
  }),

  list: wsAuthedProcedure.query(async ({ ctx }) => {
    return ctx.workspaceModel.listUserWorkspaces();
  }),

  update: wsAdminProcedure
    .input(
      z.object({
        avatar: z.string().optional(),
        description: z.string().max(1000).optional(),
        name: z.string().min(1).max(255).optional(),
        slug: z.string().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.workspaceId) return;
      return ctx.workspaceModel.update(ctx.workspaceId, input);
    }),

  updateSettings: wsAdminProcedure
    .input(z.object({ settings: z.record(z.any()) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.workspaceId) return;
      return ctx.workspaceModel.updateSettings(ctx.workspaceId, input.settings);
    }),
});

export type WorkspaceRouter = typeof workspaceRouter;
