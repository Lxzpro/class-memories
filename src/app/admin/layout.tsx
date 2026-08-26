import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return <div className="admin-shell"><aside className="admin-sidebar"><Link className="admin-brand" href="/memories"><BrandLogo className="admin-logo" priority /><div><b>拾光簿</b><small>ADMIN STUDIO</small></div></Link><nav><Link href="/admin?tab=overview">⌂ <span>概览</span></Link><Link href="/admin?tab=upload">＋ <span>批量上传</span></Link><Link href="/admin?tab=photos">▦ <span>照片管理</span></Link><Link href="/admin?tab=members">○ <span>成员审核</span></Link><Link href="/admin?tab=invites">⌁ <span>邀请口令</span></Link><Link href="/admin?tab=logs">≡ <span>操作记录</span></Link></nav><div className="admin-user"><i>{admin.displayName.slice(0,1)}</i><span><b>{admin.displayName}</b><small>管理员</small></span></div></aside><main className="admin-main">{children}</main></div>;
}
