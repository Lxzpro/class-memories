import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessMemberArea, canManageSite } from "@/lib/authz";
import { DEMO_MODE } from "@/lib/config";
import { getMockProfile } from "@/lib/mock-data";
import { verifyToken } from "@/lib/security/tokens";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/domain";

const SESSION_COOKIE = "class_memory_session";

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id), email: String(row.email), displayName: String(row.display_name),
    avatarKey: row.avatar_key ? String(row.avatar_key) : null,
    role: row.role === "admin" ? "admin" : "member",
    status: row.status === "approved" ? "approved" : row.status === "rejected" ? "rejected" : "pending",
    showRealName: Boolean(row.show_real_name), requireTagApproval: Boolean(row.require_tag_approval),
    allowOriginalDownload: Boolean(row.allow_original_download), createdAt: String(row.created_at),
  };
}

export async function getCurrentUser(): Promise<Profile | null> {
  if (DEMO_MODE) {
    const store = await cookies();
    const payload = verifyToken<{ userId: string }>(store.get(SESSION_COOKIE)?.value);
    return payload ? getMockProfile(payload.userId) : null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data ? mapProfile(data as Record<string, unknown>) : null;
}

export async function requireUser(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApprovedUser(): Promise<Profile> {
  const user = await requireUser();
  if (!canAccessMemberArea(user)) redirect("/pending");
  return user;
}

export async function requireAdmin(): Promise<Profile> {
  const user = await requireApprovedUser();
  if (!canManageSite(user)) redirect("/memories");
  return user;
}

export { SESSION_COOKIE };
