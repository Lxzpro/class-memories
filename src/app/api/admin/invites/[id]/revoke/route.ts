import { getApiAdmin } from "@/lib/api-auth";
import { writeAdminLog } from "@/lib/admin-audit";
import { DEMO_MODE } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(); if (!admin) return Response.json({ error: "无权撤销邀请。" }, { status: 403 });
  const id = (await params).id;
  if (!DEMO_MODE) { const supabase = await createSupabaseAdminClient(); const { error } = await supabase.from("invite_codes").update({ revoked_at: new Date().toISOString() }).eq("id", id); if (error) return Response.json({ error: "撤销失败。" }, { status: 500 }); }
  await writeAdminLog(admin.id, "invite_revoked", "invite_code", id);
  return Response.json({ ok: true });
}
