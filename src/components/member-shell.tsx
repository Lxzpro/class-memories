import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { MemberNav } from "@/components/member-nav";
import { DEMO_MODE } from "@/lib/config";
import type { Profile } from "@/types/domain";

export function MemberShell({
  user,
  children,
}: {
  user: Profile;
  children: ReactNode;
}) {
  const initial = user.displayName.slice(0, 1);

  return (
    <div className={`member-shell${DEMO_MODE ? " has-demo" : ""}`}>
      {DEMO_MODE && (
        <div className="global-demo-banner">
          本地演示模式 · 照片和操作不会上传到云端
        </div>
      )}

      <aside className="member-sidebar">
        <Link className="brand" href="/memories" aria-label="返回拾光簿首页">
          <BrandLogo className="brand-mark" priority />
          <span>
            <b>拾光簿</b>
            <small>OUR CLASS ARCHIVE</small>
          </span>
        </Link>
        <Link className="member-mobile-class" href="/photos">
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="4" y="7" width="16" height="13" rx="3" />
              <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
              <path d="M12 11v5m-2.5-2.5L12 11l2.5 2.5" />
            </svg>
          </span>
          <b>我们的高中班</b>
          <i aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </i>
        </Link>
        <MemberNav admin={user.role === "admin"} />
        <p className="member-sidebar-note">
          <i aria-hidden="true">⌁</i>
          不按时间，
          <br />
          只按记忆。
        </p>
        <Link
          className="member-mobile-profile"
          href="/profile"
          aria-label="进入我的页面"
        >
          {initial}
        </Link>
      </aside>

      <header className="member-topbar">
        <div className="member-archive-context">
          <b>OUR CLASS ARCHIVE</b>
          <span aria-label="仅受邀同学可见" title="仅受邀同学可见">
            ▢
          </span>
        </div>
        <Link
          className="member-global-search"
          href="/photos"
          aria-label="搜索照片"
        >
          <span aria-hidden="true">⌕</span>
          <span>搜索照片、地点、人物、回忆…</span>
        </Link>
        <Link className="member-notification" href="/profile" aria-label="查看通知">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
        </Link>
        <Link className="profile-chip" href="/profile">
          <span>{initial}</span>
          <b>{user.displayName}</b>
          <i aria-hidden="true">⌄</i>
        </Link>
      </header>

      <main className="member-main">{children}</main>
    </div>
  );
}
