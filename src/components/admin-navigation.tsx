"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type AdminIconName =
  | "overview"
  | "upload"
  | "photos"
  | "members"
  | "invites"
  | "logs";

const navigation: Array<{
  tab: AdminIconName;
  label: string;
}> = [
  { tab: "overview", label: "概览" },
  { tab: "upload", label: "批量上传" },
  { tab: "photos", label: "媒体管理" },
  { tab: "members", label: "成员审核" },
  { tab: "invites", label: "邀请口令" },
  { tab: "logs", label: "操作记录" },
];

function AdminIcon({ name }: { name: AdminIconName }) {
  if (name === "overview") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9Z" />
      </svg>
    );
  }
  if (name === "upload") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 18H6a4 4 0 1 1 .8-7.9A6 6 0 0 1 18.5 9 4.5 4.5 0 0 1 19 18h-2" />
        <path d="m9 13 3-3 3 3M12 10v10" />
      </svg>
    );
  }
  if (name === "photos") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="m6 16 4-4 3 3 2-2 3 3" />
        <circle cx="8" cy="9" r="1" />
      </svg>
    );
  }
  if (name === "members") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20M15 14.5a4 4 0 0 1 5.5 3.7V20" />
      </svg>
    );
  }
  if (name === "invites") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="16" r="3" />
        <circle cx="16" cy="8" r="3" />
        <path d="m10.2 13.8 3.6-3.6M16 5V3M19 8h2M8 19v2M5 16H3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export function AdminNavigation() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const currentTab =
    navigation.find((item) => item.tab === requestedTab)?.tab ?? "overview";

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
              <span className="admin-nav-icon" aria-hidden="true">
                <AdminIcon name={item.tab} />
              </span>
              <span className="admin-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
