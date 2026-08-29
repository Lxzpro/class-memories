"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "home" | "photos" | "video" | "upload" | "random" | "profile" | "admin";

const items: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/memories", label: "首页", icon: "home" },
  { href: "/photos", label: "照片", icon: "photos" },
  { href: "/upload", label: "上传", icon: "upload" },
  { href: "/videos", label: "视频", icon: "video" },
  { href: "/random", label: "随机", icon: "random" },
  { href: "/profile", label: "我的", icon: "profile" },
];

function NavIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === "home" && (
        <>
          <path d="m3.5 10 8.5-7 8.5 7" />
          <path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" />
        </>
      )}
      {name === "photos" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="8.2" cy="9" r="1.5" />
          <path d="m5.5 17 4.2-4.2 3.2 3 2.4-2.4 3.2 3.6" />
        </>
      )}
      {name === "video" && (
        <>
          <rect x="3" y="5" width="14" height="14" rx="3" />
          <path d="m17 10 4-2.5v9L17 14" />
          <path d="m9 9 4 3-4 3Z" />
        </>
      )}
      {name === "upload" && (
        <>
          <path d="M7 18.5H5.8A3.8 3.8 0 0 1 5.4 11 6.5 6.5 0 0 1 18 9.7a4.5 4.5 0 0 1 .4 8.8H17" />
          <path d="M12 20V10m0 0-3.2 3.2M12 10l3.2 3.2" />
        </>
      )}
      {name === "random" && (
        <>
          <path d="M4 7h3.2c4.8 0 4.8 10 9.6 10H20" />
          <path d="m17 14 3 3-3 3M4 17h3.2c1.5 0 2.5-1 3.4-2.3M14 9.3C14.8 8 15.7 7 16.8 7H20m-3-3 3 3-3 3" />
        </>
      )}
      {name === "profile" && (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </>
      )}
      {name === "admin" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
        </>
      )}
    </svg>
  );
}

export function MemberNav({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  return (
    <>
      <nav className="member-desktop-nav" aria-label="班级相册导航">
        {items.map((item) => (
          <Link
            key={item.href}
            className={`${pathname === item.href ? "active" : ""}${item.icon === "upload" ? " upload-nav" : ""}`}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
        {admin && (
          <Link
            className={pathname.startsWith("/admin") ? "active" : ""}
            href="/admin"
          >
            <NavIcon name="admin" />
            <span>管理</span>
          </Link>
        )}
      </nav>
      <nav className="member-mobile-nav" aria-label="手机底部导航">
        {items.map((item) => (
          <Link
            key={item.href}
            className={`${pathname === item.href ? "active" : ""}${item.icon === "upload" ? " upload-nav" : ""}`}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            <span aria-hidden="true">
              <NavIcon name={item.icon} />
            </span>
            <small>{item.label}</small>
          </Link>
        ))}
      </nav>
    </>
  );
}
