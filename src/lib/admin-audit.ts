import "server-only";
import { DEMO_MODE } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function writeAdminLog(adminId: string, action: string, resourceType: string, resourceId: string | null, metadata: Record<string, unknown> = {}) {
  if (DEMO_MODE) return;
  const supabase = await createSupabaseAdminClient();
  await supabase.from("admin_logs").insert({ admin_id: adminId, action, resource_type: resourceType, resource_id: resourceId, metadata });
}
