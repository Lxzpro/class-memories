import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return <AuthFrame eyebrow="WELCOME BACK" title="欢迎回来" description="登录后继续翻看属于我们班的照片。每个人看到的内容都遵循自己的照片权限。" footer={<>还没有账号？<Link href="/invite">使用班级口令加入</Link></>}><LoginForm /></AuthFrame>;
}
