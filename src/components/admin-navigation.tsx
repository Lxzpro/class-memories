"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const navigation = [
  { tab: "overview", label: "概览", icon: "⌂" },
  { tab: "upload", label: "批量上传", icon: "＋" },
  { tab: "photos", label: "照片管理", icon: "▦" },
  { tab: "members", label: "成员审核", icon: "◎" },
  { tab: "invites", label: "邀请口令", icon: "⌁" },
  { tab: "logs", label: "操作记录", icon: "≡" },
] as const;

export function AdminNavigation() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const currentTab = navigation.find((item) => item.tab === requestedTab)?.tab ?? "overview";

  return (
    <nav className="admin-nav" aria-label="管理员功能导航">
      <p>管理菜单</p>
      <div>
        {navigation.map((item) => {
          const isActive = currentTab === item.tab;

          return (
            <Link
              key={item.tab}
              href={`/admin?tab=${item.tab}`}
              className={isActive ? "active" : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="admin-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
