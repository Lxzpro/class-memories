type RuntimeEnv = Record<string, string | undefined>;

export function shouldUseDemoMode(env: RuntimeEnv = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  return env.STORAGE_DRIVER !== "r2" || !env.NEXT_PUBLIC_SUPABASE_URL;
}

export const DEMO_MODE = shouldUseDemoMode();

export function getMissingProductionEnv(env: RuntimeEnv = process.env): string[] {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY",
    "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_ENDPOINT", "AUTH_SECRET",
  ];
  return required.filter((key) => !env[key]);
}
