import { z } from "zod";
import { getApiAdmin } from "@/lib/api-auth";
import { writeAdminLog } from "@/lib/admin-audit";
import { DEMO_MODE } from "@/lib/config";
import { getStorageAdapter } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const updateSchema = z.object({ title: z.string().trim().min(1).max(100).optional(), description: z.string().trim().max(1000).optional(), location: z.string().trim().max(100).optional(), visibility: z.enum(["class", "tagged_people", "selected", "private"]).optional(), downloadAllowed: z.boolean().optional(), reviewStatus: z.enum(["draft", "published", "hidden"]).optional(), peopleIds: z.array(z.string().min(1).max(80)).max(80).optional(), selectedUserIds: z.array(z.string().min(1).max(80)).max(80).optional(), tags: z.array(z.string().trim().min(1).max(30)).max(12).optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(); if (!admin) return Response.json({ error: "无权修改照片。" }, { status: 403 });
  const id = (await params).id; const parsed = updateSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "照片资料格式不正确。" }, { status: 400 });
  if (!DEMO_MODE) {
    const supabase = await createSupabaseAdminClient(); const input = parsed.data;
    const { error } = await supabase.from("photos").update({ title: input.title, description: input.description, location: input.location, visibility: input.visibility, download_allowed: input.downloadAllowed, review_status: input.reviewStatus, updated_at: new Date().toISOString() }).eq("id", id); if (error) return Response.json({ error: "保存失败。" }, { status: 500 });
    if (input.peopleIds) {
      await supabase.from("photo_people").delete().eq("photo_id", id);
      if (input.peopleIds.length) { const { data: profiles } = await supabase.from("profiles").select("id").in("id", [...new Set(input.peopleIds)]).eq("status", "approved"); if (profiles?.length) await supabase.from("photo_people").insert(profiles.map((profile) => ({ photo_id: id, user_id: profile.id, consent_status: "approved" }))); }
    }
    if (input.selectedUserIds) { await supabase.from("photo_access").delete().eq("photo_id", id); if (input.selectedUserIds.length) await supabase.from("photo_access").insert(input.selectedUserIds.map((userId) => ({ photo_id: id, user_id: userId }))); }
    if (input.tags) { await supabase.from("photo_tags").delete().eq("photo_id", id); for (const name of input.tags) { const { data: tag } = await supabase.from("tags").upsert({ name }, { onConflict: "name" }).select("id").single(); if (tag) await supabase.from("photo_tags").insert({ photo_id: id, tag_id: tag.id }); } }
  }
  await writeAdminLog(admin.id, "photo_updated", "photo", id, parsed.data);
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(); if (!admin) return Response.json({ error: "无权删除照片。" }, { status: 403 });
  const id = (await params).id;
  if (!DEMO_MODE) {
    const supabase = await createSupabaseAdminClient(); const { data } = await supabase.from("photos").select("original_key,preview_key,thumbnail_key").eq("id", id).maybeSingle(); if (!data) return Response.json({ error: "照片不存在。" }, { status: 404 });
    await supabase.from("photos").update({ review_status: "deleted", deleted_at: new Date().toISOString() }).eq("id", id);
    await getStorageAdapter().deleteObjects([data.original_key, data.preview_key, data.thumbnail_key]);
  }
  await writeAdminLog(admin.id, "photo_deleted", "photo", id);
  return Response.json({ ok: true });
}
