"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadController = exports.UploadController = void 0;
const storage_service_1 = require("../services/storage.service");
const prisma_1 = __importDefault(require("../prisma"));
class UploadController {
    /**
     * POST or GET /api/upload
     * Generates a Cloudinary direct upload signature using cloudinary.utils.api_sign_request.
     * Returns signature, timestamp, cloud_name, api_key, and upload_url.
     */
    async getPresignedUrls(req, res) {
        try {
            const body = (req.body || {});
            const projectId = body.projectId || `proj_${Date.now()}`;
            const rawList = body.clips || body.files;
            // 1. Generate base Cloudinary signature
            const baseSignature = storage_service_1.storageService.generateUploadSignature(body.paramsToSign || {});
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
            const presignedUrls = await storage_service_1.storageService.generatePresignedBatch(rawList, projectId);
            // Sync project in database if userId provided
            if (body.userId) {
                try {
                    await prisma_1.default.videoProject.upsert({
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
                }
                catch (dbErr) {
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
        }
        catch (error) {
            console.error('❌ [UploadController] Error generating Cloudinary upload signature:', error);
            return res.status(500).json({
                error: 'Failed to generate Cloudinary upload signature',
                details: error?.message || 'Internal server error',
            });
        }
    }
}
exports.UploadController = UploadController;
exports.uploadController = new UploadController();
