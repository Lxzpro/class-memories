import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", coverage: { provider: "v8", include: ["src/lib/**/*.ts"], exclude: ["src/lib/supabase/**", "src/lib/storage/r2.ts", "src/lib/admin-data.ts", "src/lib/photos.ts", "src/lib/auth.ts"] } },
});
