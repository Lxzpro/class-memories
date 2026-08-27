import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { AdminNavigation } from "@/components/admin-navigation";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin?tab=overview">
          <BrandLogo className="admin-logo" priority />
          <div><b>拾光簿</b><small>ADMIN STUDIO</small></div>
        </Link>
        <AdminNavigation />
        <div className="admin-sidebar-footer">
          <Link className="admin-return-link" href="/memories">← 返回班级相册</Link>
          <div className="admin-user">
            <i>{admin.displayName.slice(0, 1)}</i>
            <span><b>{admin.displayName}</b><small>管理员</small></span>
          </div>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
