import { z } from "zod";
import { getApiMember } from "@/lib/api-auth";
import { DEMO_MODE } from "@/lib/config";
import { MOCK_PHOTOS } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ consentStatus: z.enum(["approved", "rejected"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiMember(); if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });
  const id = (await params).id; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "确认状态无效。" }, { status: 400 });
  if (DEMO_MODE) { const tagged = MOCK_PHOTOS.some((photo) => photo.id === id && photo.people.some((person) => person.id === user.id && person.consentStatus === "pending")); if (!tagged) return Response.json({ error: "没有待确认记录。" }, { status: 404 }); return Response.json({ ok: true }); }
  const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.from("photo_people").update({ consent_status: parsed.data.consentStatus }).eq("photo_id", id).eq("user_id", user.id).eq("consent_status", "pending").select("photo_id").maybeSingle();
  if (error || !data) return Response.json({ error: "确认失败或记录已经处理。" }, { status: 409 });
  return Response.json({ ok: true });
}
