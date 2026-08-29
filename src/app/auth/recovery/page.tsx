import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";

export const metadata: Metadata = {
  title: "继续重置密码｜拾光簿",
  referrer: "no-referrer",
};

export default async function RecoveryConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[] }>;
}) {
  const { token_hash: tokenHashValue } = await searchParams;
  const tokenHash = typeof tokenHashValue === "string" ? tokenHashValue : "";

  if (!tokenHash) redirect("/forgot-password?error=invalid_recovery");

  return (
    <AuthFrame
      eyebrow="RESET ACCESS"
      title="继续设置新密码"
      description="为了避免邮箱安全扫描误用一次性链接，请确认由你本人继续操作。"
    >
      <form className="auth-form" action="/auth/callback" method="post">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <p className="form-success" role="status">
          重置链接已通过初步检查。点击下方按钮后，将进入新密码设置页面。
        </p>
        <button className="form-submit" type="submit">
          继续设置新密码<span aria-hidden="true">→</span>
        </button>
      </form>
    </AuthFrame>
  );
}
