import { z } from "zod";
import { getApiMember } from "@/lib/api-auth";
import { DEMO_MODE } from "@/lib/config";
import { getVisiblePhoto } from "@/lib/photos";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  photoId: z.string().min(1).max(80),
  kind: z.enum(["hide", "delete"]),
  message: z.string().trim().max(500).default(""),
});

export async function POST(request: Request) {
  const user = await getApiMember();
  if (!user) return Response.json({ error: "请先以已通过审核的成员身份登录。" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "申请内容不完整。" }, { status: 400 });
  const photo = await getVisiblePhoto(user, parsed.data.photoId);
  if (!photo) return Response.json({ error: "照片不存在，或你没有查看权限。" }, { status: 404 });

  if (DEMO_MODE) {
    return Response.json({ request: { id: crypto.randomUUID(), ...parsed.data, status: "pending", createdAt: new Date().toISOString() } }, { status: 201 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("privacy_requests").insert({ user_id: user.id, photo_id: photo.id, kind: parsed.data.kind, message: parsed.data.message }).select("id,status,created_at").single();
  if (error?.code === "23505") return Response.json({ error: "这张照片已有相同的待处理申请。" }, { status: 409 });
  if (error || !data) return Response.json({ error: "申请提交失败，请稍后再试。" }, { status: 500 });
  return Response.json({ request: { id: data.id, photoId: photo.id, kind: parsed.data.kind, message: parsed.data.message, status: data.status, createdAt: data.created_at } }, { status: 201 });
}
