import { z } from "zod";
import { getApiAdmin } from "@/lib/api-auth";
import { writeAdminLog } from "@/lib/admin-audit";
import { DEMO_MODE } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const schema = z.object({ status: z.enum(["resolved", "rejected"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin();
  if (!admin) return Response.json({ error: "无权处理隐私申请。" }, { status: 403 });
  const id = (await params).id;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "处理状态无效。" }, { status: 400 });

  let photoId: string | null = null;
  let kind: "hide" | "delete" | null = null;
  if (!DEMO_MODE) {
    const supabase = await createSupabaseAdminClient();
    const { data: privacyRequest } = await supabase.from("privacy_requests").select("photo_id,kind,status").eq("id", id).maybeSingle();
    if (!privacyRequest || privacyRequest.status !== "pending") return Response.json({ error: "申请不存在或已经处理。" }, { status: 404 });
    photoId = privacyRequest.photo_id ? String(privacyRequest.photo_id) : null;
    kind = privacyRequest.kind;
    if (parsed.data.status === "resolved" && photoId) {
      const { error: hideError } = await supabase.from("photos").update({ review_status: "hidden" }).eq("id", photoId).neq("review_status", "deleted");
      if (hideError) return Response.json({ error: "照片暂时隐藏失败。" }, { status: 500 });
    }
    const { error } = await supabase.from("privacy_requests").update({ status: parsed.data.status, resolved_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
    if (error) return Response.json({ error: "申请处理失败。" }, { status: 500 });
  }

  await writeAdminLog(admin.id, `privacy_request_${parsed.data.status}`, "privacy_request", id, { photoId, kind, photoHidden: parsed.data.status === "resolved" });
  return Response.json({ ok: true, photoHidden: parsed.data.status === "resolved" });
}
