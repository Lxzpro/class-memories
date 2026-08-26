export const DEMO_MODE = process.env.STORAGE_DRIVER !== "r2" || !process.env.NEXT_PUBLIC_SUPABASE_URL;

export function getMissingProductionEnv(): string[] {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY",
    "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_ENDPOINT", "AUTH_SECRET",
  ];
  return required.filter((key) => !process.env[key]);
}
