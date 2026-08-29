import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production" || process.env.STORAGE_DRIVER === "r2") {
    throw new Error("AUTH_SECRET 尚未配置，或长度不足 32 个字符");
  }
  return "demo-only-secret-change-before-production";
}

function signature(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function signToken<T extends object>(payload: T, expiresAt: number): string {
  const encoded = Buffer.from(JSON.stringify({ ...payload, exp: expiresAt })).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyToken<T extends object>(token: string | undefined): (T & { exp: number }) | null {
  if (!token) return null;
  const [encoded, supplied] = token.split(".");
  if (!encoded || !supplied) return null;
  const expected = signature(encoded);
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T & { exp: number };
    return typeof payload.exp === "number" && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function hashInviteCode(code: string): string {
  return createHmac("sha256", secret()).update(code.trim().toUpperCase()).digest("hex");
}

export function safeHashEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
