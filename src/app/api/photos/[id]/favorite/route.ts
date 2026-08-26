import { getCurrentUser } from "@/lib/auth";
import { canAccessMemberArea } from "@/lib/authz";
import { DEMO_MODE } from "@/lib/config";
import { getVisiblePhoto } from "@/lib/photos";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!canAccessMemberArea(user)) return Response.json({ error: "请先登录。" }, { status: 401 });
  const { id } = await params; if (!(await getVisiblePhoto(user, id))) return Response.json({ error: "照片不存在或无权访问。" }, { status: 404 });
  if (DEMO_MODE) return Response.json({ ok: true, demo: true });
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("favorites").select("photo_id").eq("user_id", user.id).eq("photo_id", id).maybeSingle();
  const result = data ? await supabase.from("favorites").delete().eq("user_id", user.id).eq("photo_id", id) : await supabase.from("favorites").insert({ user_id: user.id, photo_id: id });
  return result.error ? Response.json({ error: "收藏操作失败。" }, { status: 500 }) : Response.json({ ok: true, favorite: !data });
}
