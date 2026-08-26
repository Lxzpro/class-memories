import Link from "next/link";
import type { ReactNode } from "react";
import { DEMO_MODE } from "@/lib/config";
import type { Profile } from "@/types/domain";
import { MemberNav } from "@/components/member-nav";
import { BrandLogo } from "@/components/brand-logo";

export function MemberShell({ user, children }: { user: Profile; children: ReactNode }) {
  return <div className="member-shell">
    {DEMO_MODE && <div className="global-demo-banner">本地演示模式 · 照片和操作不会上传到云端</div>}
    <header className="member-header">
      <Link className="brand" href="/memories"><BrandLogo className="brand-mark" priority /><span><b>拾光簿</b><small>OUR CLASS ARCHIVE</small></span></Link>
      <MemberNav admin={user.role === "admin"} />
      <Link className="profile-chip" href="/profile"><span>{user.displayName.slice(0, 1)}</span><b>{user.displayName}</b></Link>
    </header>
    <main className="member-main">{children}</main>
  </div>;
}
