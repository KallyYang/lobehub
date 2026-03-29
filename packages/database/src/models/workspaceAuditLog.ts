import { and, desc, eq, gte, lte } from 'drizzle-orm';

import type { NewWorkspaceAuditLog } from '../schemas';
import { workspaceAuditLogs } from '../schemas';
import type { LobeChatDatabase } from '../type';

export class WorkspaceAuditLogModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  /**
   * Record an audit log entry
   */
  log = async (entry: Omit<NewWorkspaceAuditLog, 'id' | 'createdAt'>) => {
    const [result] = await this.db
      .insert(workspaceAuditLogs)
      .values(entry)
      .returning();

    return result;
  };

  /**
   * Query audit logs with filters
   */
  query = async (params: {
    action?: string;
    from?: Date;
    limit?: number;
    offset?: number;
    resourceType?: string;
    to?: Date;
    userId?: string;
    workspaceId: string;
  }) => {
    const { workspaceId, action, resourceType, userId, from, to, limit = 50, offset = 0 } = params;

    const conditions = [eq(workspaceAuditLogs.workspaceId, workspaceId)];

    if (action) conditions.push(eq(workspaceAuditLogs.action, action));
    if (resourceType) conditions.push(eq(workspaceAuditLogs.resourceType, resourceType));
    if (userId) conditions.push(eq(workspaceAuditLogs.userId, userId));
    if (from) conditions.push(gte(workspaceAuditLogs.createdAt, from));
    if (to) conditions.push(lte(workspaceAuditLogs.createdAt, to));

    return this.db
      .select()
      .from(workspaceAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(workspaceAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  };
}

/**
 * Helper to create audit log entries from routers/services.
 * Designed for fire-and-forget usage — errors are logged but don't break the main flow.
 */
export const auditLog = async (
  db: LobeChatDatabase,
  entry: Omit<NewWorkspaceAuditLog, 'id' | 'createdAt'>,
) => {
  try {
    const model = new WorkspaceAuditLogModel(db);
    await model.log(entry);
  } catch (error) {
    console.error('[AuditLog] Failed to write audit log:', error);
  }
};
