import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return <AuthFrame eyebrow="JOIN THE CLASS" title="留下你的名字" description="账号创建并确认邮箱后会进入待审核状态。管理员确认身份后，你就能进入完整相册。" footer={<>已经有账号？<Link href="/login">返回登录</Link></>}><RegisterForm /></AuthFrame>;
}
