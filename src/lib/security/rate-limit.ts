interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, maxAttempts = 5, windowMs = 10 * 60 * 1000, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterMs: 0 };
  }
  if (current.count >= maxAttempts) {
    return { allowed: false, remaining: 0, retryAfterMs: current.resetAt - now };
  }
  current.count += 1;
  return { allowed: true, remaining: maxAttempts - current.count, retryAfterMs: 0 };
}

export function resetRateLimit(key: string) { buckets.delete(key); }
