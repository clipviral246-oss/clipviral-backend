import { v2 as cloudinary } from 'cloudinary';
import { ENV } from '../config/env';

export interface CloudinaryUploadSignature {
  signature: string;
  timestamp: number;
  cloud_name: string;
  api_key: string;
  upload_url: string;
}

export interface BatchUploadClipItem {
  id: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  fileType?: string;
}

export interface PresignedUrlResult {
  clipId: string;
  fileName: string;
  uploadUrl: string;
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  storageKey: string;
  expiresInSeconds: number;
}

export class StorageService {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || ENV.CLOUDINARY_CLOUD_NAME || 'lgxkjpat';
    this.apiKey = process.env.CLOUDINARY_API_KEY || ENV.CLOUDINARY_API_KEY || '886617579976247';
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || ENV.CLOUDINARY_API_SECRET || '6hjFuHAn2kCJJh-TBmuPwIjl4nU';

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      secure: true,
    });
  }

  /**
   * Generates a single Cloudinary upload signature for client-side direct upload
   */
  generateUploadSignature(customParams: Record<string, any> = {}): CloudinaryUploadSignature {
    const timestamp = customParams.timestamp || Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, any> = {
      timestamp,
      ...customParams,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, this.apiSecret);

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
  async generatePresignedBatch(
    clips: BatchUploadClipItem[],
    projectId: string
  ): Promise<PresignedUrlResult[]> {
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request({ timestamp }, this.apiSecret);

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

export const storageService = new StorageService();
