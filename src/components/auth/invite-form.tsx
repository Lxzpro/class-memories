"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/auth/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "口令验证失败");
      router.push("/register");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "口令验证失败"); }
    finally { setLoading(false); }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="invite-code">班级口令</label>
      <div className="invite-input-wrap"><input id="invite-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="输入管理员发给你的口令" autoComplete="one-time-code" required /><span aria-hidden="true">•••</span></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="form-submit" type="submit" disabled={loading}>{loading ? "正在验证…" : "验证口令并继续"}<span aria-hidden="true">→</span></button>
    </form>
  );
}
