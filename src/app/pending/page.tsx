import { LogoutButton } from "@/components/auth/logout-button";
import { requireUser } from "@/lib/auth";

export default async function PendingPage() {
  const user = await requireUser();
  return <main className="pending-page"><section><div className="pending-seal">待</div><p className="eyebrow"><span /> MEMBER REVIEW</p><h1>{user.displayName}，申请已经收到</h1><p>管理员确认你是班级成员后，相册就会自动为你开放。你现在不需要重复注册。</p><div className="pending-status"><i /><span><b>等待管理员审核</b><small>审核完成后即可进入班级相册</small></span></div><LogoutButton className="text-logout" /></section></main>;
}
