"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "登录失败");
      router.push(result.next); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "登录失败"); }
    finally { setLoading(false); }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="email">邮箱</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      <div className="label-row"><label htmlFor="password">密码</label><Link href="/forgot-password">忘记密码？</Link></div>
      <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="form-submit" type="submit" disabled={loading}>{loading ? "正在登录…" : "登录班级相册"}<span aria-hidden="true">→</span></button>
    </form>
  );
}
