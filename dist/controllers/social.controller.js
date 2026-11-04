"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialController = exports.SocialController = void 0;
const social_service_1 = require("../services/social.service");
class SocialController {
    /**
     * GET /api/social/status/:userId or GET /api/social/publish
     */
    async getStatus(req, res) {
        try {
            const userId = String(req.params.userId || req.query.userId || 'demo-user-id');
            const status = await social_service_1.socialService.getConnectedAccounts(userId);
            return res.status(200).json(status);
        }
        catch (error) {
            console.error('❌ [SocialController] Error getting social status:', error);
            return res.status(500).json({ error: error.message });
        }
    }
    /**
     * GET /api/social/publish
     */
    async getPublishStatus(req, res) {
        try {
            const userId = String(req.query.userId || 'demo-user-id');
            const status = await social_service_1.socialService.getConnectedAccounts(userId);
            return res.status(200).json(status);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    /**
     * GET /api/social/oauth/tiktok/authorize
     */
    tiktokAuthorize(req, res) {
        try {
            const userId = req.query.userId || 'demo-user-id';
            const redirect = req.query.redirect === 'true';
            const { url, state } = social_service_1.socialService.getTikTokAuthUrl(userId);
            if (redirect) {
                return res.redirect(url);
            }
            return res.status(200).json({ url, state });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    /**
     * GET /api/social/oauth/tiktok/callback
     */
    async tiktokCallback(req, res) {
        try {
            const code = req.query.code;
            const state = req.query.state;
            if (!code) {
                return res.status(400).json({ error: 'Missing code parameter' });
            }
            const result = await social_service_1.socialService.handleTikTokCallback(code, state || '');
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    /**
     * GET /api/social/oauth/instagram/authorize
     */
    instagramAuthorize(req, res) {
        try {
            const userId = req.query.userId || 'demo-user-id';
            const redirect = req.query.redirect === 'true';
            const { url, state } = social_service_1.socialService.getInstagramAuthUrl(userId);
            if (redirect) {
                return res.redirect(url);
            }
            return res.status(200).json({ url, state });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    /**
     * GET /api/social/oauth/instagram/callback
     */
    async instagramCallback(req, res) {
        try {
            const code = req.query.code;
            const state = req.query.state;
            if (!code) {
                return res.status(400).json({ error: 'Missing code parameter' });
            }
            const result = await social_service_1.socialService.handleInstagramCallback(code, state || '');
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    /**
     * POST /api/social/simulate-connect
     */
    async simulateConnect(req, res) {
        try {
            const { userId = 'demo-user-id', platform } = req.body;
            if (!platform || !['tiktok', 'instagram'].includes(platform)) {
                return res.status(400).json({ error: 'Valid platform ("tiktok" | "instagram") is required' });
            }
            await social_service_1.socialService.linkDemoAccount(userId, platform);
            return res.status(200).json({
                success: true,
                message: `${platform.toUpperCase()} account successfully linked to profile!`,
                connected: true,
            });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    /**
     * POST /api/social/publish
     */
    async publish(req, res) {
        try {
            const { userId = 'demo-user-id', platform, videoUrl, caption, simulateConnect, } = req.body;
            if (!platform || !['tiktok', 'instagram'].includes(platform)) {
                return res.status(400).json({ error: 'Invalid platform. Must be "tiktok" or "instagram".' });
            }
            // Support 1-click simulate connect from UI
            if (simulateConnect) {
                await social_service_1.socialService.linkDemoAccount(userId, platform);
                return res.status(200).json({
                    success: true,
                    message: `${platform.toUpperCase()} account successfully linked to profile!`,
                    connected: true,
                });
            }
            if (!videoUrl) {
                return res.status(400).json({ error: 'videoUrl is required.' });
            }
            const result = await social_service_1.socialService.publishVideo({
                userId,
                platform,
                videoUrl,
                caption,
            });
            return res.status(200).json(result);
        }
        catch (error) {
            if (error.message?.includes('ACCOUNT_NOT_CONNECTED')) {
                return res.status(403).json({
                    error: 'ACCOUNT_NOT_CONNECTED',
                    message: error.message,
                });
            }
            return res.status(500).json({ error: error.message });
        }
    }
}
exports.SocialController = SocialController;
exports.socialController = new SocialController();
