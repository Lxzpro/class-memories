import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { canAccessMemberArea, canManageSite } from "@/lib/authz";

export async function getApiMember() { const user = await getCurrentUser(); return canAccessMemberArea(user) ? user : null; }
export async function getApiAdmin() { const user = await getCurrentUser(); return canManageSite(user) ? user : null; }
