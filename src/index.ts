import express, { Request, Response } from 'express';
import cors from 'cors';
import { ENV } from './config/env';
import { uploadController } from './controllers/upload.controller';
import { videoController } from './controllers/video.controller';
import { stripeController } from './controllers/stripe.controller';
import { socialController } from './controllers/social.controller';
import { startVideoWorker } from './queues/video.worker';
import { uploadRateLimiter, videoProcessRateLimiter } from './middlewares/rateLimiter';

const app = express();
const PORT = ENV.PORT || 4000;

// ==========================================
// 1. CORS Configuration (Frontend: localhost:3000)
// ==========================================
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ENV.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || ENV.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'stripe-signature',
      'Cache-Control',
    ],
  })
);

// ==========================================
// 2. Stripe Webhook (Raw Buffer Parser)
// ==========================================
// Stripe webhooks require the raw unaltered Buffer to verify HMAC signature
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response) => stripeController.handleWebhook(req, res)
);
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response) => stripeController.handleWebhook(req, res)
);

// ==========================================
// 3. Body Parsers for Standard REST APIs
// ==========================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==========================================
// 4. REST API Routes
// ==========================================

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ClipViral AI Video Editor - Standalone Node.js Backend',
  });
});
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ClipViral AI Video Editor - Standalone Node.js Backend',
  });
});

// A. Cloudinary Batch Signed Upload URLs (Protected by Strict Rate Limiter: max 20 req / 15m)
app.get('/api/upload', uploadRateLimiter, (req, res) => uploadController.getPresignedUrls(req, res));
app.post('/api/upload', uploadRateLimiter, (req, res) => uploadController.getPresignedUrls(req, res));
app.post('/api/storage/upload-urls', uploadRateLimiter, (req, res) => uploadController.getPresignedUrls(req, res));

// B. BullMQ + Redis Background Video Processing Pipeline (Protected: max 20 jobs / 15m)
app.post('/api/video/process', videoProcessRateLimiter, (req, res) => videoController.triggerProcessing(req, res));
app.post('/api/jobs/process', videoProcessRateLimiter, (req, res) => videoController.triggerProcessing(req, res));
app.get('/api/video/status/:jobId', (req, res) => videoController.getJobStatus(req, res));
app.get('/api/jobs/status/:jobId', (req, res) => videoController.getJobStatus(req, res));

// C. Stripe Subscription Checkout & Plans
app.get('/api/checkout/plans', (req, res) => stripeController.getPlans(req, res));
app.post('/api/checkout', (req, res) => stripeController.createCheckout(req, res));
app.post('/api/stripe/checkout', (req, res) => stripeController.createCheckout(req, res));

// D. Social Media OAuth & Publishing (TikTok & Instagram Reels)
app.get('/api/social/publish', (req, res) => socialController.getPublishStatus(req, res));
app.get('/api/social/status/:userId', (req, res) => socialController.getStatus(req, res));
app.get('/api/social/oauth/tiktok/authorize', (req, res) => socialController.tiktokAuthorize(req, res));
app.get('/api/social/oauth/tiktok/callback', (req, res) => socialController.tiktokCallback(req, res));
app.get('/api/social/oauth/instagram/authorize', (req, res) => socialController.instagramAuthorize(req, res));
app.get('/api/social/oauth/instagram/callback', (req, res) => socialController.instagramCallback(req, res));
app.post('/api/social/simulate-connect', (req, res) => socialController.simulateConnect(req, res));
app.post('/api/social/publish', (req, res) => socialController.publish(req, res));

// ==========================================
// 5. Initialize BullMQ Video Worker & Start Server
// ==========================================
try {
  startVideoWorker();
  console.log('⚡ [BullMQ Worker] Video processing queue worker registered.');
} catch (err) {
  console.warn('⚠️ [BullMQ Worker] Could not connect to Redis worker immediately:', err);
}

const server = app.listen(PORT, () => {
  console.log('=============================================================');
  console.log(`🚀 ClipViral AI Backend running on: http://localhost:${PORT}`);
  console.log(`🔒 CORS securely configured for frontend: ${allowedOrigins.join(', ')}`);
  console.log(`📦 Cloudinary Direct Upload API: POST http://localhost:${PORT}/api/upload`);
  console.log(`⚡ BullMQ Job Pipeline: POST http://localhost:${PORT}/api/video/process`);
  console.log(`💳 Stripe Webhooks: POST http://localhost:${PORT}/api/webhooks/stripe`);
  console.log(`📱 TikTok & Instagram APIs: http://localhost:${PORT}/api/social/*`);
  console.log('=============================================================');
});

export default app;
export { server };

