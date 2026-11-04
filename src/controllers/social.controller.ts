import { Request, Response } from 'express';
import { socialService } from '../services/social.service';

export class SocialController {
  /**
   * GET /api/social/status/:userId or GET /api/social/publish
   */
  async getStatus(req: Request, res: Response) {
    try {
      const userId = String(req.params.userId || req.query.userId || 'demo-user-id');
      const status = await socialService.getConnectedAccounts(userId);
      return res.status(200).json(status);
    } catch (error: any) {
      console.error('❌ [SocialController] Error getting social status:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/social/publish
   */
  async getPublishStatus(req: Request, res: Response) {
    try {
      const userId = String(req.query.userId || 'demo-user-id');
      const status = await socialService.getConnectedAccounts(userId);
      return res.status(200).json(status);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/social/oauth/tiktok/authorize
   */
  tiktokAuthorize(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || 'demo-user-id';
      const redirect = req.query.redirect === 'true';
      const { url, state } = socialService.getTikTokAuthUrl(userId);

      if (redirect) {
        return res.redirect(url);
      }
      return res.status(200).json({ url, state });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/social/oauth/tiktok/callback
   */
  async tiktokCallback(req: Request, res: Response) {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code) {
        return res.status(400).json({ error: 'Missing code parameter' });
      }

      const result = await socialService.handleTikTokCallback(code, state || '');
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/social/oauth/instagram/authorize
   */
  instagramAuthorize(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || 'demo-user-id';
      const redirect = req.query.redirect === 'true';
      const { url, state } = socialService.getInstagramAuthUrl(userId);

      if (redirect) {
        return res.redirect(url);
      }
      return res.status(200).json({ url, state });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/social/oauth/instagram/callback
   */
  async instagramCallback(req: Request, res: Response) {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code) {
        return res.status(400).json({ error: 'Missing code parameter' });
      }

      const result = await socialService.handleInstagramCallback(code, state || '');
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/social/simulate-connect
   */
  async simulateConnect(req: Request, res: Response) {
    try {
      const { userId = 'demo-user-id', platform } = req.body;
      if (!platform || !['tiktok', 'instagram'].includes(platform)) {
        return res.status(400).json({ error: 'Valid platform ("tiktok" | "instagram") is required' });
      }

      await socialService.linkDemoAccount(userId, platform);
      return res.status(200).json({
        success: true,
        message: `${platform.toUpperCase()} account successfully linked to profile!`,
        connected: true,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/social/publish
   */
  async publish(req: Request, res: Response) {
    try {
      const {
        userId = 'demo-user-id',
        platform,
        videoUrl,
        caption,
        simulateConnect,
      } = req.body;

      if (!platform || !['tiktok', 'instagram'].includes(platform)) {
        return res.status(400).json({ error: 'Invalid platform. Must be "tiktok" or "instagram".' });
      }

      // Support 1-click simulate connect from UI
      if (simulateConnect) {
        await socialService.linkDemoAccount(userId, platform);
        return res.status(200).json({
          success: true,
          message: `${platform.toUpperCase()} account successfully linked to profile!`,
          connected: true,
        });
      }

      if (!videoUrl) {
        return res.status(400).json({ error: 'videoUrl is required.' });
      }

      const result = await socialService.publishVideo({
        userId,
        platform,
        videoUrl,
        caption,
      });

      return res.status(200).json(result);
    } catch (error: any) {
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

export const socialController = new SocialController();
