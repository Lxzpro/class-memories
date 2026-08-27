import { AdminDashboard } from "@/components/admin-dashboard";
import { getAdminDashboardData } from "@/lib/admin-data";
import { writeAdminLog } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin(); const data = await getAdminDashboardData();
  await writeAdminLog(admin.id, "admin_dashboard_viewed", "admin", null);
  const requested = (await searchParams).tab;
  const initialTab = typeof requested === "string" && ["overview", "upload", "photos", "members", "invites", "logs"].includes(requested) ? requested : "overview";
  return (
    <AdminDashboard
      initialData={data}
      initialTab={initialTab}
      demoMode={DEMO_MODE}
      adminName={admin.displayName}
    />
  );
}
