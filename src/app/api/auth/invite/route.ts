import { z } from "zod";
import { DEMO_MODE } from "@/lib/config";
import { MOCK_INVITE_CODE } from "@/lib/demo-invites";
import { evaluateInvite, inviteErrorMessage } from "@/lib/invites";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { hashInviteCode, safeHashEquals, signToken } from "@/lib/security/tokens";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { InviteCodeRecord } from "@/types/domain";

const schema = z.object({ code: z.string().trim().min(4).max(64) });

function mapInvite(row: Record<string, unknown>): InviteCodeRecord {
  return { id: String(row.id), codeHash: String(row.code_hash), expiresAt: String(row.expires_at), maxUses: Number(row.max_uses), usedCount: Number(row.used_count), revokedAt: row.revoked_at ? String(row.revoked_at) : null, createdBy: String(row.created_by), createdAt: String(row.created_at) };
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = checkRateLimit(`invite:${ip}`);
  if (!limit.allowed) return Response.json({ error: "尝试次数过多，请稍后再试。", retryAfterMs: limit.retryAfterMs }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "请输入有效的班级口令。" }, { status: 400 });
  const codeHash = hashInviteCode(parsed.data.code);
  let invite: InviteCodeRecord | null = null;

  if (DEMO_MODE) {
    if (safeHashEquals(codeHash, hashInviteCode(MOCK_INVITE_CODE))) {
      invite = { id: "invite-demo", codeHash, expiresAt: "2099-12-31T23:59:59.000Z", maxUses: 50, usedCount: 8, revokedAt: null, createdBy: "user-admin", createdAt: "2026-08-01T08:00:00.000Z" };
    }
  } else {
    const supabase = await createSupabaseAdminClient();
    const { data } = await supabase
      .from("invite_codes")
      .select("id,code_hash,expires_at,max_uses,used_count,revoked_at,created_by,created_at")
      .eq("code_hash", codeHash)
      .maybeSingle();
    invite = data ? mapInvite(data as Record<string, unknown>) : null;
  }

  const decision = evaluateInvite(invite);
  if (!decision.valid) return Response.json({ error: inviteErrorMessage[decision.reason] }, { status: 400 });
  if (!invite) return Response.json({ error: "没有找到这个班级口令。" }, { status: 400 });
  resetRateLimit(`invite:${ip}`);

  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `invite_grant=${signToken({ inviteId: invite.id }, Date.now() + 30 * 60 * 1000)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
