import { DEMO_MODE } from "@/lib/config";
import { SESSION_COOKIE } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  if (!DEMO_MODE) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  return response;
}
