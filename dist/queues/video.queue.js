"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoQueue = exports.VIDEO_PROCESSING_QUEUE = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
exports.VIDEO_PROCESSING_QUEUE = 'video-processing';
// BullMQ Queue instance
exports.videoQueue = new bullmq_1.Queue(exports.VIDEO_PROCESSING_QUEUE, {
    connection: redis_1.redisConnectionOptions,
});
exports.videoQueue.on('error', (err) => {
    console.error(`[BullMQ Queue Connection Error]: ${err.message}`);
});
