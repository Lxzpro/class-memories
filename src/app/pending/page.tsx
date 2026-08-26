import { LogoutButton } from "@/components/auth/logout-button";
import { requireUser } from "@/lib/auth";

export default async function PendingPage() {
  const user = await requireUser();
  return <main className="pending-page"><section><div className="pending-seal">待</div><p className="eyebrow"><span /> MEMBER REVIEW</p><h1>{user.displayName}，申请已经收到</h1><p>管理员确认你是班级成员后，相册就会自动为你开放。你现在不需要重复注册。</p><div className="pending-status"><i /><span><b>等待管理员审核</b><small>演示模式下可使用现成的同学账号查看完整网站</small></span></div><a className="pending-login" href="/login">使用演示同学账号</a><LogoutButton className="text-logout" /></section></main>;
}
