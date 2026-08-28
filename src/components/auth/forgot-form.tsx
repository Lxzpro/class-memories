"use client";
import { useState } from "react";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return <form className="auth-form" onSubmit={async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const result = await response.json();
      if (response.ok) setMessage(result.message);
      else setError(result.error);
    } catch {
      setError("暂时无法发送邮件，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }}>
    <label htmlFor="reset-email">注册邮箱</label><input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
    {message && <p className="form-success" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <button className="form-submit" type="submit" disabled={loading}>{loading ? "正在发送…" : "发送重置邮件"}<span aria-hidden="true">→</span></button>
  </form>;
}
