import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { MemberNav } from "@/components/member-nav";
import { UserAvatar } from "@/components/user-avatar";
import { DEMO_MODE } from "@/lib/config";
import type { Profile } from "@/types/domain";

export function MemberShell({
  user,
  children,
}: {
  user: Profile;
  children: ReactNode;
}) {
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
        <MemberNav admin={user.role === "admin"} variant="desktop" />
        <p className="member-sidebar-note">
          <i aria-hidden="true">⌁</i>
          不按时间，
          <br />
          只按记忆。
        </p>
        <div className="member-mobile-actions">
          <Link
            className="member-mobile-random"
            href="/random?mode=shuffle"
            aria-label="随机翻一张回忆"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h3.2c4.8 0 4.8 10 9.6 10H20" />
              <path d="m17 14 3 3-3 3M4 17h3.2c1.5 0 2.5-1 3.4-2.3M14 9.3C14.8 8 15.7 7 16.8 7H20m-3-3 3 3-3 3" />
            </svg>
          </Link>
          {user.role === "admin" && (
            <Link
              className="member-mobile-admin"
              href="/admin"
              aria-label="进入管理员界面"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3 19 6v5c0 4.6-2.8 8.2-7 10-4.2-1.8-7-5.4-7-10V6l7-3Z" />
                <path d="M9 12h6M12 9v6" />
              </svg>
              <small>管理</small>
            </Link>
          )}
          <Link
            className="member-mobile-profile"
            href="/profile"
            aria-label="进入我的页面"
          >
            <UserAvatar user={user} size={44} priority />
          </Link>
        </div>
      </aside>

      <MemberNav variant="mobile" />

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
          <UserAvatar user={user} size={40} priority />
          <b>{user.displayName}</b>
          <i aria-hidden="true">⌄</i>
        </Link>
      </header>

      <main className="member-main">{children}</main>
    </div>
  );
}
