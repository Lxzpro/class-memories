import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const INVITE_CIPHER_VERSION = "v1";
const INVITE_CIPHER_CONTEXT = Buffer.from("class-memories:invite-code:v1");

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

function inviteEncryptionKey(): Buffer {
  return createHmac("sha256", secret())
    .update("class-memories:invite-code-encryption:v1")
    .digest();
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

/**
 * Keeps a recoverable copy for administrators without storing the invite code
 * as plaintext. The random IV and authentication tag make ciphertext tampering
 * fail closed. AUTH_SECRET remains the only server-side secret involved.
 */
export function encryptInviteCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", inviteEncryptionKey(), iv);
  cipher.setAAD(INVITE_CIPHER_CONTEXT);
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    INVITE_CIPHER_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptInviteCode(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;

  try {
    const [version, encodedIv, encodedTag, encodedValue, ...extra] = ciphertext.split(".");
    if (
      version !== INVITE_CIPHER_VERSION ||
      !encodedIv ||
      !encodedTag ||
      !encodedValue ||
      extra.length > 0
    ) {
      return null;
    }

    const iv = Buffer.from(encodedIv, "base64url");
    const tag = Buffer.from(encodedTag, "base64url");
    const encrypted = Buffer.from(encodedValue, "base64url");
    if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) return null;

    const decipher = createDecipheriv("aes-256-gcm", inviteEncryptionKey(), iv);
    decipher.setAAD(INVITE_CIPHER_CONTEXT);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function safeHashEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
