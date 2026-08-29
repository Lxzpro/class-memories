import { z } from "zod";
import { getApiAdmin } from "@/lib/api-auth";
import { writeAdminLog } from "@/lib/admin-audit";
import { DEMO_MODE } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const schema = z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(100), description: z.string().trim().max(1000), location: z.string().trim().max(100), width: z.number().int().positive(), height: z.number().int().positive(), mediaType: z.enum(["photo", "video"]).default("photo"), visibility: z.enum(["class", "tagged_people", "selected", "private"]), downloadAllowed: z.boolean(), originalKey: z.string(), previewKey: z.string(), thumbnailKey: z.string(), tags: z.array(z.string().trim().min(1).max(30)).max(12), peopleIds: z.array(z.string().min(1).max(80)).max(80).default([]) });

export async function POST(request: Request) {
  const admin = await getApiAdmin(); if (!admin) return Response.json({ error: "仅管理员可以发布照片。" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "媒体资料不完整。" }, { status: 400 });
  if (!DEMO_MODE) {
    const supabase = await createSupabaseAdminClient(); const photo = parsed.data;
    const { error } = await supabase.from("photos").insert({ id: photo.id, title: photo.title, description: photo.description, original_key: photo.originalKey, preview_key: photo.previewKey, thumbnail_key: photo.thumbnailKey, width: photo.width, height: photo.height, location: photo.location, visibility: photo.visibility, download_allowed: photo.downloadAllowed, review_status: "published", uploaded_by: admin.id });
    if (error) return Response.json({ error: "媒体资料保存失败。" }, { status: 500 });
    if (photo.peopleIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id").in("id", [...new Set(photo.peopleIds)]).eq("status", "approved");
      const people = (profiles ?? []).map((profile) => ({ photo_id: photo.id, user_id: profile.id, consent_status: "approved" }));
      if (people.length) {
        const { error: peopleError } = await supabase.from("photo_people").insert(people);
        if (peopleError) { await supabase.from("photos").delete().eq("id", photo.id); return Response.json({ error: "人物关联保存失败。" }, { status: 500 }); }
      }
    }
    for (const name of photo.tags) { const { data: tag } = await supabase.from("tags").upsert({ name }, { onConflict: "name" }).select("id").single(); if (tag) await supabase.from("photo_tags").insert({ photo_id: photo.id, tag_id: tag.id }); }
  }
  await writeAdminLog(admin.id, "photo_published", "photo", parsed.data.id, { visibility: parsed.data.visibility, mediaType: parsed.data.mediaType, peopleCount: parsed.data.peopleIds.length });
  return Response.json({ ok: true, photo: parsed.data });
}
