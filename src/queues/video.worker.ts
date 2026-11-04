import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { VIDEO_PROCESSING_QUEUE, VideoJobData } from './video.queue';
import { transcribeService } from '../services/transcribe.service';
import { ffmpegService } from '../services/ffmpeg.service';
import prisma from '../prisma';
import path from 'path';

export function startVideoWorker() {
  const worker = new Worker<VideoJobData>(
    VIDEO_PROCESSING_QUEUE,
    async (job: Job<VideoJobData>) => {
      const { jobId, projectId, clipIds, options } = job.data;
      console.log(`🎬 [BullMQ Worker] Starting processing for Job ${jobId} (Project ${projectId})`);

      try {
        await job.updateProgress(10);
        await prisma.videoProject.updateMany({
          where: { id: projectId },
          data: { status: 'processing' },
        });

        // Step 1: Transcribe with Whisper API & detect filler words
        const inputClipUrl = `https://storage.clipviral.ai/projects/${projectId}/raw/${clipIds[0] || 'clip_01'}.mp4`;
        const transcription = await transcribeService.transcribeWithWordTimestamps(inputClipUrl, {
          language: options.subtitleLanguage,
          minSilenceThreshold: options.removeSilence ? 0.35 : 10.0,
        });

        await job.updateProgress(50);
        console.log(
          `🎙️ [BullMQ Worker] Whisper finished: ${transcription.words.length} words, ${transcription.fillerWords.length} filler words.`
        );

        // Step 2: FFmpeg Cutting with 15ms anti-click audio micro-fades
        const outputDir = path.join(process.cwd(), 'temp_renders');
        const outputFilePath = path.join(outputDir, `${jobId}_cut.mp4`);

        const render = await ffmpegService.renderCutVideo(
          inputClipUrl,
          outputFilePath,
          transcription.keepSegments,
          async (percent) => {
            await job.updateProgress(50 + Math.round(percent * 0.45));
          }
        );

        const renderedVideoUrl = `https://cdn.clipviral.ai/renders/${jobId}/master.mp4`;
        const subtitlesUrl = `https://cdn.clipviral.ai/renders/${jobId}/subtitles.vtt`;

        // Step 3: Update VideoProject status to 'ready' in Prisma
        await prisma.videoProject.updateMany({
          where: { id: projectId },
          data: {
            status: 'ready',
            renderedVideoUrl,
            subtitlesUrl,
            duration: render.renderedDuration,
            timelineData: JSON.stringify({
              cuts: transcription.keepSegments,
              fillerWords: transcription.fillerWords,
              words: transcription.words,
              cutsCount: render.cutsCount,
            }),
          },
        });

        await job.updateProgress(100);
        console.log(`✅ [BullMQ Worker] Job ${jobId} completed! VideoProject ${projectId} is ready.`);

        return {
          success: true,
          jobId,
          projectId,
          renderedVideoUrl,
          subtitlesUrl,
          duration: render.renderedDuration,
          cutsCount: render.cutsCount,
          removedFillerWords: transcription.fillerWords.length,
        };
      } catch (err: any) {
        console.error(`❌ [BullMQ Worker] Job ${jobId} failed:`, err);
        await prisma.videoProject.updateMany({
          where: { id: projectId },
          data: { status: 'failed' },
        });
        throw err;
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: 4, // 4 concurrent video jobs
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ Worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error(`[BullMQ Worker Connection Error]: ${err.message}`);
  });

  return worker;
}
