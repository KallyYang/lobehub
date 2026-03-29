import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid/non-secure';

import { workspaceInvitations, workspaceMembers } from '../schemas';
import type { LobeChatDatabase } from '../type';
import { idGenerator } from '../utils/idGenerator';

const INVITATION_EXPIRY_DAYS = 7;

export class WorkspaceMemberModel {
  private userId: string;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  // ===== Members ===== //

  addMember = async (params: { role?: 'admin' | 'editor' | 'member'; userId: string; workspaceId: string }) => {
    const [result] = await this.db
      .insert(workspaceMembers)
      .values({
        role: params.role ?? 'member',
        userId: params.userId,
        workspaceId: params.workspaceId,
      })
      .onConflictDoNothing()
      .returning();

    return result;
  };

  getMember = async (workspaceId: string, userId: string) => {
    return this.db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    });
  };

  listMembers = async (workspaceId: string) => {
    return this.db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.workspaceId, workspaceId),
    });
  };

  removeMember = async (workspaceId: string, userId: string) => {
    return this.db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      );
  };

  updateMemberRole = async (workspaceId: string, userId: string, role: 'admin' | 'editor' | 'member') => {
    return this.db
      .update(workspaceMembers)
      .set({ role })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      );
  };

  // ===== Invitations ===== //

  createInvitation = async (params: {
    email?: string;
    role?: 'admin' | 'editor' | 'member';
    workspaceId: string;
  }) => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const [result] = await this.db
      .insert(workspaceInvitations)
      .values({
        email: params.email,
        expiresAt,
        id: idGenerator('workspaceInvitations'),
        inviterId: this.userId,
        role: params.role ?? 'member',
        token: nanoid(32),
        workspaceId: params.workspaceId,
      })
      .returning();

    return result;
  };

  findInvitationByToken = async (token: string) => {
    return this.db.query.workspaceInvitations.findFirst({
      where: eq(workspaceInvitations.token, token),
    });
  };

  listPendingInvitations = async (workspaceId: string) => {
    return this.db.query.workspaceInvitations.findMany({
      where: and(
        eq(workspaceInvitations.workspaceId, workspaceId),
        eq(workspaceInvitations.status, 'pending'),
      ),
    });
  };

  revokeInvitation = async (id: string) => {
    return this.db
      .update(workspaceInvitations)
      .set({ status: 'revoked' })
      .where(eq(workspaceInvitations.id, id));
  };

  updateInvitationStatus = async (id: string, status: 'accepted' | 'expired' | 'revoked') => {
    return this.db
      .update(workspaceInvitations)
      .set({ status })
      .where(eq(workspaceInvitations.id, id));
  };
}
