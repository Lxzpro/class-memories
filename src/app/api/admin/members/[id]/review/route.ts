import { z } from "zod";
import { getApiAdmin } from "@/lib/api-auth";
import { writeAdminLog } from "@/lib/admin-audit";
import { DEMO_MODE } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const schema = z.object({ status: z.enum(["approved", "rejected"]) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(); if (!admin) return Response.json({ error: "无权审核成员。" }, { status: 403 });
  const id = (await params).id; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success || id === admin.id) return Response.json({ error: "审核操作无效。" }, { status: 400 });
  if (!DEMO_MODE) { const supabase = await createSupabaseAdminClient(); const { error } = await supabase.from("profiles").update({ status: parsed.data.status }).eq("id", id).eq("role", "member"); if (error) return Response.json({ error: "审核失败。" }, { status: 500 }); }
  await writeAdminLog(admin.id, `member_${parsed.data.status}`, "profile", id);
  return Response.json({ ok: true });
}
