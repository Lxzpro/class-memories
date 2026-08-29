import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const recoveryRequest = type === "recovery";
  const emailConfirmationRequest = type === "email" || type === "signup";
  const fallback = recoveryRequest ? "/reset-password" : emailConfirmationRequest ? "/pending" : "/memories";
  const requestedNext = url.searchParams.get("next") || fallback;
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : fallback;

  if (DEMO_MODE) return NextResponse.redirect(new URL(next, url.origin));

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    return NextResponse.redirect(new URL("/forgot-password?error=invalid_recovery", url.origin));
  }

  if (tokenHash && (type === "email" || type === "signup")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    return NextResponse.redirect(new URL("/login?error=email_confirmation", url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  const errorPath = recoveryRequest
    ? "/forgot-password?error=invalid_recovery"
    : emailConfirmationRequest
      ? "/login?error=email_confirmation"
      : "/login?error=auth_callback";
  return NextResponse.redirect(new URL(errorPath, url.origin));
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const formData = await request.formData();
  const tokenHash = formData.get("token_hash");

  if (typeof tokenHash !== "string" || !tokenHash) {
    return NextResponse.redirect(new URL("/forgot-password?error=invalid_recovery", url.origin), 303);
  }

  if (DEMO_MODE) {
    return NextResponse.redirect(new URL("/reset-password", url.origin), 303);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });

  if (error) {
    return NextResponse.redirect(new URL("/forgot-password?error=invalid_recovery", url.origin), 303);
  }

  return NextResponse.redirect(new URL("/reset-password", url.origin), 303);
}
