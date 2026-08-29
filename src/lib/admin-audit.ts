import "server-only";
import { DEMO_MODE } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function writeAdminLog(adminId: string, action: string, resourceType: string, resourceId: string | null, metadata: Record<string, unknown> = {}) {
  if (DEMO_MODE) return;
  try {
    const supabase = await createSupabaseAdminClient();
    const { error } = await supabase.from("admin_logs").insert({ admin_id: adminId, action, resource_type: resourceType, resource_id: resourceId, metadata });
    if (!error) return;
    console.error("admin_audit_write_failed", {
      action,
      resourceType,
      resourceId,
      reason: error.code ?? "unknown",
    });
  } catch (error) {
    console.error("admin_audit_write_failed", {
      action,
      resourceType,
      resourceId,
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}
