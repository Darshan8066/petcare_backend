/**
 * Minimal fixed-window rate limiter with no external dependencies.
 *
 * Note: counters live in this process only. Behind multiple instances each one
 * keeps its own window, so treat this as a brute-force speed bump rather than a
 * hard quota. Put a shared limiter (Redis, or your platform's edge limiter) in
 * front of the API if you need strict limits.
 */

const buckets = new Map();

// Drop expired buckets periodically so memory does not grow without bound.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS);
sweeper.unref?.();

const clientKey = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : (forwarded || '').split(',')[0].trim() || req.ip || req.socket?.remoteAddress || 'unknown';
  return `${ip}:${req.baseUrl}${req.path}`;
};

export const rateLimit = ({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = 'Too many requests. Please try again later.'
} = {}) => (req, res, next) => {
  const key = clientKey(req);
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  const remaining = Math.max(0, max - bucket.count);
  res.setHeader('RateLimit-Limit', max);
  res.setHeader('RateLimit-Remaining', remaining);
  res.setHeader('RateLimit-Reset', Math.ceil((bucket.resetAt - now) / 1000));

  if (bucket.count > max) {
    res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
    return res.status(429).json({ success: false, message });
  }

  return next();
};

/** Tight limit for credential endpoints (login / register). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT) || 20,
  message: 'Too many sign-in attempts. Please wait a few minutes and try again.'
});

/** Broad limit applied to the whole API. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT) || 300
});
