import rateLimit from 'express-rate-limit';

/**
 * Strict limiter for authentication — slows brute-force attempts.
 * 10 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please try again later.' },
});

/**
 * General API limiter — protects public/mutation endpoints from abuse.
 * 100 requests per minute per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' },
});

/**
 * Limiter for unauthenticated read endpoints that poll (status page, upcoming
 * maintenance). Generous enough for a 30-second client refresh across many
 * browser tabs behind one NAT, tight enough to stop a scraping loop.
 * 240 requests per minute per IP.
 */
export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' },
});
