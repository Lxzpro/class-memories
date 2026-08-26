import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { InviteForm } from "@/components/auth/invite-form";

export default function InvitePage() {
  return <AuthFrame eyebrow="PRIVATE ENTRANCE" title="先确认，你是我们班的人" description="输入管理员发给你的限时口令。验证通过后，你可以创建自己的班级账号。" footer={<>已经加入过？<Link href="/login">直接登录</Link></>}><InviteForm /></AuthFrame>;
}
