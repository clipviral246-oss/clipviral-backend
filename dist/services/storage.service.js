"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = exports.StorageService = void 0;
const cloudinary_1 = require("cloudinary");
const env_1 = require("../config/env");
class StorageService {
    cloudName;
    apiKey;
    apiSecret;
    constructor() {
        this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || env_1.ENV.CLOUDINARY_CLOUD_NAME || 'lgxkjpat';
        this.apiKey = process.env.CLOUDINARY_API_KEY || env_1.ENV.CLOUDINARY_API_KEY || '886617579976247';
        this.apiSecret = process.env.CLOUDINARY_API_SECRET || env_1.ENV.CLOUDINARY_API_SECRET || '6hjFuHAn2kCJJh-TBmuPwIjl4nU';
        cloudinary_1.v2.config({
            cloud_name: this.cloudName,
            api_key: this.apiKey,
            api_secret: this.apiSecret,
            secure: true,
        });
    }
    /**
     * Generates a single Cloudinary upload signature for client-side direct upload
     */
    generateUploadSignature(customParams = {}) {
        const timestamp = customParams.timestamp || Math.round(Date.now() / 1000);
        const paramsToSign = {
            timestamp,
            ...customParams,
        };
        const signature = cloudinary_1.v2.utils.api_sign_request(paramsToSign, this.apiSecret);
        return {
            signature,
            timestamp,
            cloud_name: this.cloudName,
            api_key: this.apiKey,
            upload_url: `https://api.cloudinary.com/v1_1/${this.cloudName}/video/upload`,
        };
    }
    /**
     * Generates Cloudinary upload signatures for multiple clips in a batch
     */
    async generatePresignedBatch(clips, projectId) {
        const timestamp = Math.round(Date.now() / 1000);
        const signature = cloudinary_1.v2.utils.api_sign_request({ timestamp }, this.apiSecret);
        return clips.map((clip) => {
            const sanitizedName = clip.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const storageKey = `clipviral/projects/${projectId}/raw/${clip.id}_${sanitizedName}`;
            return {
                clipId: clip.id,
                fileName: clip.fileName,
                uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/video/upload`,
                signature,
                timestamp,
                apiKey: this.apiKey,
                cloudName: this.cloudName,
                storageKey,
                expiresInSeconds: 3600,
            };
        });
    }
}
exports.StorageService = StorageService;
exports.storageService = new StorageService();
