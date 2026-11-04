import rateLimit from 'express-rate-limit';

/**
 * Strict Rate Limiter for Video Uploads
 * Restricts each client IP to a maximum of 20 upload signature requests per 15 minutes.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true, // Draft-6 RateLimit headers
  legacyHeaders: false, // Disable X-RateLimit-*
  message: {
    success: false,
    error: 'Upload rate limit exceeded: Maximum 20 requests per 15 minutes allowed from this IP.',
    retryAfterMinutes: 15,
  },
});

/**
 * Strict Rate Limiter for Video Processing Pipeline (FFmpeg & Whisper)
 * Prevents queue flooding and denial-of-service on heavy GPU/CPU rendering resources.
 */
export const videoProcessRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Video processing quota reached: Maximum 20 video rendering jobs allowed per 15 minutes from this IP.',
    retryAfterMinutes: 15,
  },
});
