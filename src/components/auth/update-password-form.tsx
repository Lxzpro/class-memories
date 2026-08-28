"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function UpdatePasswordForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return <form className="auth-form" onSubmit={async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("两次输入的密码不一致，请重新确认。");
      return;
    }
    setLoading(true);
    if (!demoMode) {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("密码更新失败，重置链接可能已失效，请重新申请一封邮件。");
        setLoading(false);
        return;
      }
    }
    router.push("/memories");
    router.refresh();
  }}>
    <label htmlFor="new-password">新密码</label><input id="new-password" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
    <label htmlFor="confirm-password">确认新密码</label><input id="confirm-password" type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required />
    {error && <p className="form-error" role="alert">{error}</p>}<button className="form-submit" type="submit" disabled={loading}>{loading ? "正在更新…" : "保存新密码"}<span aria-hidden="true">→</span></button>
  </form>;
}
