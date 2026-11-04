import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';

export interface VideoJobData {
  jobId: string;
  projectId: string;
  clipIds: string[];
  options: {
    removeSilence: boolean;
    generateSubtitles: boolean;
    subtitleLanguage: 'de' | 'en' | 'auto';
  };
}

export const VIDEO_PROCESSING_QUEUE = 'video-processing';

// BullMQ Queue instance
export const videoQueue = new Queue<VideoJobData>(VIDEO_PROCESSING_QUEUE, {
  connection: redisConnectionOptions,
});

videoQueue.on('error', (err) => {
  console.error(`[BullMQ Queue Connection Error]: ${err.message}`);
});
