import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return <AuthFrame eyebrow="JOIN THE CLASS" title="留下你的名字" description="账号创建后会进入待审核状态。管理员确认身份后，你就能进入完整相册。" footer={<>邀请验证失效？<Link href="/invite">重新验证口令</Link></>}><RegisterForm /></AuthFrame>;
}
