"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type RegisterResponse = {
  emailConfirmationRequired?: boolean;
  error?: string;
  next?: string;
};

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json() as RegisterResponse;
      if (!response.ok) throw new Error(result.error || "注册失败");
      if (result.emailConfirmationRequired) {
        setConfirmationEmail(form.email);
        return;
      }
      router.push(result.next || "/pending");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  if (confirmationEmail) {
    return (
      <div className="auth-form" aria-live="polite">
        <p className="form-success">账号已经创建，确认邮件已发送至 {confirmationEmail}。</p>
        <p className="field-note">请点击邮件中的“确认邮箱并提交审核”。确认成功后，你会进入班级成员审核页面；如果没有看到邮件，也请检查垃圾邮件。</p>
        <Link className="form-submit" href="/login">返回登录<span aria-hidden="true">→</span></Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="display-name">你的名字或常用昵称</label><input id="display-name" value={form.displayName} onChange={(event) => update("displayName", event.target.value)} autoComplete="name" required />
      <label htmlFor="register-email">邮箱</label><input id="register-email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required />
      <label htmlFor="register-password">设置密码</label><input id="register-password" type="password" minLength={8} value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete="new-password" required />
      <p className="field-note">至少 8 位。真实模式下密码只由 Supabase Auth 处理。</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="form-submit" type="submit" disabled={loading}>{loading ? "正在创建账号…" : "创建账号并等待审核"}<span aria-hidden="true">→</span></button>
    </form>
  );
}
