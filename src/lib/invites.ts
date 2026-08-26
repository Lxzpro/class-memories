import type { InviteCodeRecord } from "@/types/domain";

export type InviteDecision = { valid: true } | { valid: false; reason: "expired" | "revoked" | "exhausted" | "not_found" };

export function evaluateInvite(invite: InviteCodeRecord | null, now = Date.now()): InviteDecision {
  if (!invite) return { valid: false, reason: "not_found" };
  if (invite.revokedAt) return { valid: false, reason: "revoked" };
  if (new Date(invite.expiresAt).getTime() <= now) return { valid: false, reason: "expired" };
  if (invite.usedCount >= invite.maxUses) return { valid: false, reason: "exhausted" };
  return { valid: true };
}

export const inviteErrorMessage: Record<Exclude<InviteDecision, { valid: true }>["reason"], string> = {
  not_found: "没有找到这个班级口令，请检查后重试。",
  expired: "这个班级口令已经过期，请联系管理员获取新口令。",
  revoked: "这个班级口令已经被撤销，请联系管理员。",
  exhausted: "这个班级口令已达到使用次数上限。",
};
