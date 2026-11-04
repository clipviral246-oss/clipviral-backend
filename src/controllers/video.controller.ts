import { Request, Response } from 'express';
import { videoQueue } from '../queues/video.queue';
import prisma from '../prisma';

export class VideoController {
  /**
   * POST /api/video/process
   * Trigger background video cutting pipeline (Whisper STT + Filler detection + FFmpeg)
   */
  async triggerProcessing(req: Request, res: Response) {
    try {
      const {
        projectId = `proj_${Date.now()}`,
        userId = 'demo-user-id',
        title = 'Untitled Project',
        clipIds = ['clip_01'],
        rawVideoUrls = [],
        options = {
          removeSilence: true,
          generateSubtitles: true,
          subtitleLanguage: 'de',
        },
      } = req.body;

      // 1. Ensure/create project record in Prisma
      const project = await prisma.videoProject.upsert({
        where: { id: projectId },
        update: {
          status: 'queued',
          updatedAt: new Date(),
        },
        create: {
          id: projectId,
          userId,
          title,
          status: 'queued',
          cloudRawUrls: rawVideoUrls.length > 0 ? rawVideoUrls : clipIds.map((c: string) => `https://storage.clipviral.ai/raw/${c}.mp4`),
        },
      });

      // 2. Add job to BullMQ queue
      const jobId = `job_${projectId}_${Date.now()}`;
      const job = await videoQueue.add(
        'process-video-cuts',
        {
          jobId,
          projectId: project.id,
          clipIds,
          options,
        },
        {
          jobId,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: false,
          removeOnFail: false,
        }
      );

      return res.status(202).json({
        success: true,
        message: 'Video processing job enqueued successfully.',
        jobId: job.id,
        projectId: project.id,
        status: 'queued',
      });
    } catch (error: any) {
      console.error('❌ [VideoController] Error triggering video process:', error);
      return res.status(500).json({
        error: 'Failed to enqueue video processing job',
        details: error?.message || 'Internal server error',
      });
    }
  }

  /**
   * GET /api/video/status/:jobId
   * Check status and progress of BullMQ background video processing job
   */
  async getJobStatus(req: Request, res: Response) {
    try {
      const jobId = String(req.params.jobId);
      const job = await videoQueue.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          error: 'Job not found in queue',
          jobId,
        });
      }

      const state = await job.getState();
      const progress = job.progress;
      const result = job.returnvalue;
      const failedReason = job.failedReason;

      return res.status(200).json({
        jobId: job.id,
        state,
        progress,
        result,
        failedReason,
        data: job.data,
      });
    } catch (error: any) {
      console.error('❌ [VideoController] Error fetching job status:', error);
      return res.status(500).json({
        error: 'Failed to retrieve job status',
        details: error?.message || 'Internal server error',
      });
    }
  }

  /**
   * GET /api/video/projects/:projectId
   * Get project data from Prisma
   */
  async getProject(req: Request, res: Response) {
    try {
      const projectId = String(req.params.projectId);
      const project = await prisma.videoProject.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      return res.status(200).json(project);
    } catch (error: any) {
      console.error('❌ [VideoController] Error fetching project:', error);
      return res.status(500).json({
        error: 'Failed to retrieve project',
        details: error?.message || 'Internal server error',
      });
    }
  }
}

export const videoController = new VideoController();
