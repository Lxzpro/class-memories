import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  const description = error === "email_confirmation"
    ? "这封邮件中的确认链接已失效或已被使用，请重新注册或联系管理员。"
    : "登录后继续翻看属于我们班的照片。每个人看到的内容都遵循自己的照片权限。";

  return <AuthFrame eyebrow="WELCOME BACK" title="欢迎回来" description={description} footer={<>还没有账号？<Link href="/invite">使用班级口令加入</Link></>}><LoginForm /></AuthFrame>;
}
