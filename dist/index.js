"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const upload_controller_1 = require("./controllers/upload.controller");
const video_controller_1 = require("./controllers/video.controller");
const stripe_controller_1 = require("./controllers/stripe.controller");
const social_controller_1 = require("./controllers/social.controller");
const video_worker_1 = require("./queues/video.worker");
const app = (0, express_1.default)();
const PORT = env_1.ENV.PORT || 4000;
// ==========================================
// 1. CORS Configuration (Frontend: localhost:3000)
// ==========================================
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    env_1.ENV.FRONTEND_URL,
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || env_1.ENV.NODE_ENV !== 'production') {
            callback(null, true);
        }
        else {
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
}));
// ==========================================
// 2. Stripe Webhook (Raw Buffer Parser)
// ==========================================
// Stripe webhooks require the raw unaltered Buffer to verify HMAC signature
app.post('/api/webhooks/stripe', express_1.default.raw({ type: 'application/json' }), (req, res) => stripe_controller_1.stripeController.handleWebhook(req, res));
app.post('/api/stripe/webhook', express_1.default.raw({ type: 'application/json' }), (req, res) => stripe_controller_1.stripeController.handleWebhook(req, res));
// ==========================================
// 3. Body Parsers for Standard REST APIs
// ==========================================
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// ==========================================
// 4. REST API Routes
// ==========================================
// Health Check
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'ClipViral AI Video Editor - Standalone Node.js Backend',
    });
});
app.get('/api/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'ClipViral AI Video Editor - Standalone Node.js Backend',
    });
});
// A. Cloudinary Batch Signed Upload URLs
app.get('/api/upload', (req, res) => upload_controller_1.uploadController.getPresignedUrls(req, res));
app.post('/api/upload', (req, res) => upload_controller_1.uploadController.getPresignedUrls(req, res));
app.post('/api/storage/upload-urls', (req, res) => upload_controller_1.uploadController.getPresignedUrls(req, res));
// B. BullMQ + Redis Background Video Processing Pipeline (FFmpeg + Whisper)
app.post('/api/video/process', (req, res) => video_controller_1.videoController.triggerProcessing(req, res));
app.post('/api/jobs/process', (req, res) => video_controller_1.videoController.triggerProcessing(req, res));
app.get('/api/video/status/:jobId', (req, res) => video_controller_1.videoController.getJobStatus(req, res));
app.get('/api/jobs/status/:jobId', (req, res) => video_controller_1.videoController.getJobStatus(req, res));
// C. Stripe Subscription Checkout & Plans
app.get('/api/checkout/plans', (req, res) => stripe_controller_1.stripeController.getPlans(req, res));
app.post('/api/checkout', (req, res) => stripe_controller_1.stripeController.createCheckout(req, res));
app.post('/api/stripe/checkout', (req, res) => stripe_controller_1.stripeController.createCheckout(req, res));
// D. Social Media OAuth & Publishing (TikTok & Instagram Reels)
app.get('/api/social/publish', (req, res) => social_controller_1.socialController.getPublishStatus(req, res));
app.get('/api/social/status/:userId', (req, res) => social_controller_1.socialController.getStatus(req, res));
app.get('/api/social/oauth/tiktok/authorize', (req, res) => social_controller_1.socialController.tiktokAuthorize(req, res));
app.get('/api/social/oauth/tiktok/callback', (req, res) => social_controller_1.socialController.tiktokCallback(req, res));
app.get('/api/social/oauth/instagram/authorize', (req, res) => social_controller_1.socialController.instagramAuthorize(req, res));
app.get('/api/social/oauth/instagram/callback', (req, res) => social_controller_1.socialController.instagramCallback(req, res));
app.post('/api/social/simulate-connect', (req, res) => social_controller_1.socialController.simulateConnect(req, res));
app.post('/api/social/publish', (req, res) => social_controller_1.socialController.publish(req, res));
// ==========================================
// 5. Initialize BullMQ Video Worker & Start Server
// ==========================================
try {
    (0, video_worker_1.startVideoWorker)();
    console.log('⚡ [BullMQ Worker] Video processing queue worker registered.');
}
catch (err) {
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
exports.server = server;
exports.default = app;
