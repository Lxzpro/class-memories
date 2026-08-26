"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "注册失败");
      router.push(result.next); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "注册失败"); }
    finally { setLoading(false); }
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
