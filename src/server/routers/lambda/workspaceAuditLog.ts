import { z } from 'zod';

import { WorkspaceAuditLogModel } from '@/database/models/workspaceAuditLog';
import { router, workspaceAdminProcedure } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const auditProcedure = workspaceAdminProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      auditLogModel: new WorkspaceAuditLogModel(ctx.serverDB),
    },
  });
});

export const workspaceAuditLogRouter = router({
  /**
   * Query audit logs (admin+ only)
   */
  query: auditProcedure
    .input(
      z.object({
        action: z.string().optional(),
        from: z.date().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        resourceType: z.string().optional(),
        to: z.date().optional(),
        userId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.workspaceId) return [];

      return ctx.auditLogModel.query({
        ...input,
        workspaceId: ctx.workspaceId,
      });
    }),
});
