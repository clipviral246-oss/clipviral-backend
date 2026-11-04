import { Request, Response } from 'express';
import { storageService, BatchUploadClipItem } from '../services/storage.service';
import prisma from '../prisma';

export class UploadController {
  /**
   * POST or GET /api/upload
   * Generates a Cloudinary direct upload signature using cloudinary.utils.api_sign_request.
   * Returns signature, timestamp, cloud_name, api_key, and upload_url.
   */
  async getPresignedUrls(req: Request, res: Response) {
    try {
      const body = (req.body || {}) as {
        clips?: BatchUploadClipItem[];
        files?: BatchUploadClipItem[];
        projectId?: string;
        userId?: string;
        paramsToSign?: Record<string, any>;
      };

      const projectId = body.projectId || `proj_${Date.now()}`;
      const rawList = body.clips || body.files;

      // 1. Generate base Cloudinary signature
      const baseSignature = storageService.generateUploadSignature(body.paramsToSign || {});

      // 2. If no clips/files provided in body, return direct signature payload for single/adhoc uploads
      if (!rawList || !Array.isArray(rawList) || rawList.length === 0) {
        return res.status(200).json({
          success: true,
          signature: baseSignature.signature,
          timestamp: baseSignature.timestamp,
          cloud_name: baseSignature.cloud_name,
          api_key: baseSignature.api_key,
          upload_url: baseSignature.upload_url,
          projectId,
        });
      }

      // 3. If batch list is provided, generate signed items for each clip
      if (rawList.length > 50) {
        return res.status(400).json({
          error: 'Batch upload limit exceeded: Maximum 50 clips per batch request.',
        });
      }

      const presignedUrls = await storageService.generatePresignedBatch(rawList, projectId);

      // Sync project in database if userId provided
      if (body.userId) {
        try {
          await prisma.videoProject.upsert({
            where: { id: projectId },
            update: {
              cloudRawUrls: presignedUrls.map((p) => p.storageKey),
              status: 'uploading',
            },
            create: {
              id: projectId,
              userId: body.userId,
              title: `Batch Video Project (${rawList.length} clips)`,
              status: 'uploading',
              cloudRawUrls: presignedUrls.map((p) => p.storageKey),
            },
          });
        } catch (dbErr) {
          console.warn('⚠️ [UploadController] Could not sync project record in DB:', dbErr);
        }
      }

      return res.status(200).json({
        success: true,
        signature: baseSignature.signature,
        timestamp: baseSignature.timestamp,
        cloud_name: baseSignature.cloud_name,
        api_key: baseSignature.api_key,
        upload_url: baseSignature.upload_url,
        projectId,
        totalClips: presignedUrls.length,
        data: presignedUrls,
        uploads: presignedUrls,
      });
    } catch (error: any) {
      console.error('❌ [UploadController] Error generating Cloudinary upload signature:', error);
      return res.status(500).json({
        error: 'Failed to generate Cloudinary upload signature',
        details: error?.message || 'Internal server error',
      });
    }
  }
}

export const uploadController = new UploadController();
