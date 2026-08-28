import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/:path*",
    "/memories/:path*",
    "/pending/:path*",
    "/photos/:path*",
    "/profile/:path*",
    "/random/:path*",
    "/reset-password/:path*",
    "/upload/:path*",
  ],
};
