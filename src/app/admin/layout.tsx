import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { AdminNavigation } from "@/components/admin-navigation";
import { UserAvatar } from "@/components/user-avatar";
import "./admin.css";
import "./admin-redesign.css";
import "./reference-admin.css";
import "./reference-admin-user.css";
import "./reference-admin-note.css";
import "./reference-admin-icons.css";
import "../ui-ux-polish.css";
import "./mobile-admin-polish.css";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin?tab=overview">
          <BrandLogo className="admin-logo" priority />
          <div>
            <b>拾光簿</b>
            <small>ADMIN STUDIO</small>
          </div>
        </Link>
        <AdminNavigation />
        <div className="admin-sidebar-footer">
          <Link className="admin-return-link" href="/memories">
            ← 返回班级相册
          </Link>
          <div className="admin-user">
            <i>
              <UserAvatar user={admin} size={38} />
            </i>
            <span>
              <b>{admin.displayName}</b>
              <small>管理员</small>
            </span>
          </div>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
