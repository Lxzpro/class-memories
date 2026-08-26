import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { getApiAdmin } from "@/lib/api-auth";
import { writeAdminLog } from "@/lib/admin-audit";
import { DEMO_MODE } from "@/lib/config";
import { hashInviteCode } from "@/lib/security/tokens";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const schema = z.object({ validDays: z.number().int().min(1).max(60), maxUses: z.number().int().min(1).max(100) });
function createCode() { return `CLASS-${randomBytes(4).toString("hex").toUpperCase()}`; }

export async function POST(request: Request) {
  const admin = await getApiAdmin(); if (!admin) return Response.json({ error: "无权创建邀请。" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "有效期应为 1～60 天，使用次数应为 1～100。" }, { status: 400 });
  const code = createCode(); const id = randomUUID(); const expiresAt = new Date(Date.now() + parsed.data.validDays * 86400000).toISOString();
  if (!DEMO_MODE) { const supabase = await createSupabaseAdminClient(); const { error } = await supabase.from("invite_codes").insert({ id, code_hash: hashInviteCode(code), expires_at: expiresAt, max_uses: parsed.data.maxUses, used_count: 0, created_by: admin.id }); if (error) return Response.json({ error: "创建邀请失败。" }, { status: 500 }); }
  await writeAdminLog(admin.id, "invite_created", "invite_code", id, { expiresAt, maxUses: parsed.data.maxUses });
  return Response.json({ invite: { id, code, expiresAt, maxUses: parsed.data.maxUses, usedCount: 0, revokedAt: null } });
}
