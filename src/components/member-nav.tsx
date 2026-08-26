"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/memories", label: "首页", icon: "⌂" },
  { href: "/photos", label: "照片", icon: "▦" },
  { href: "/random", label: "随机", icon: "✦" },
  { href: "/profile", label: "我的", icon: "○" },
];

export function MemberNav({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  return (
    <>
      <nav className="member-desktop-nav" aria-label="班级相册导航">
        {items.map((item) => <Link key={item.href} className={pathname === item.href ? "active" : ""} href={item.href}>{item.label}</Link>)}
        {admin && <Link className={pathname.startsWith("/admin") ? "active" : ""} href="/admin">管理</Link>}
      </nav>
      <nav className="member-mobile-nav" aria-label="手机底部导航">
        {items.map((item) => <Link key={item.href} className={pathname === item.href ? "active" : ""} href={item.href}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></Link>)}
      </nav>
    </>
  );
}
