import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { ForgotForm } from "@/components/auth/forgot-form";

export default function ForgotPasswordPage() {
  return <AuthFrame eyebrow="RESET ACCESS" title="重新找回相册入口" description="输入注册邮箱。为了保护隐私，无论账号是否存在，我们都会显示相同的结果。" footer={<Link href="/login">返回登录</Link>}><ForgotForm /></AuthFrame>;
}
