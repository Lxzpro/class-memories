import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessMemberArea } from "@/lib/authz";
import { DEMO_MODE } from "@/lib/config";
import { getPhotoComments, getVisiblePhoto } from "@/lib/photos";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ content: z.string().trim().min(1).max(300) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!canAccessMemberArea(user)) return Response.json({ error: "请先登录。" }, { status: 401 });
  return Response.json({ comments: await getPhotoComments(user, (await params).id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!canAccessMemberArea(user)) return Response.json({ error: "请先登录。" }, { status: 401 });
  const id = (await params).id; if (!(await getVisiblePhoto(user, id))) return Response.json({ error: "照片不存在或无权访问。" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "留言应为 1～300 个字符。" }, { status: 400 });
  const content = parsed.data.content.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (DEMO_MODE) return Response.json({ comment: { id: `demo-${Date.now()}`, photoId: id, userId: user.id, authorName: user.displayName, content, status: "visible", createdAt: new Date().toISOString() } });
  const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.from("comments").insert({ photo_id: id, user_id: user.id, content, status: "visible" }).select("id,created_at").single();
  if (error) return Response.json({ error: "留言失败。" }, { status: 500 });
  return Response.json({ comment: { id: data.id, photoId: id, userId: user.id, authorName: user.displayName, content, status: "visible", createdAt: data.created_at } });
}
