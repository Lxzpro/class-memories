import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { DEMO_MODE } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  if (!DEMO_MODE) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/forgot-password?error=invalid_recovery");
  }

  return <AuthFrame eyebrow="NEW PASSWORD" title="设置一个新密码" description="新密码至少 8 位。更新成功后，你会回到班级相册。"><UpdatePasswordForm demoMode={DEMO_MODE} /></AuthFrame>;
}
