"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function UpdatePasswordForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter(); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  return <form className="auth-form" onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(""); if (!demoMode) { const supabase = createSupabaseBrowserClient(); const { error: updateError } = await supabase.auth.updateUser({ password }); if (updateError) { setError("密码更新失败，请重新打开邮件中的链接。"); setLoading(false); return; } } router.push("/memories"); router.refresh(); }}><label htmlFor="new-password">新密码</label><input id="new-password" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />{error && <p className="form-error">{error}</p>}<button className="form-submit" type="submit" disabled={loading}>{loading ? "正在更新…" : "保存新密码"}<span>→</span></button></form>;
}
