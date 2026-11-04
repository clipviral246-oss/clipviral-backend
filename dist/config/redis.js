"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnectionOptions = void 0;
const env_1 = require("./env");
// Upstash and cloud-hosted Redis require a secure TLS connection.
// Safely enable tls: {} for Upstash / remote hosts while preserving plain TCP for local dev.
const isLocal = env_1.ENV.REDIS_HOST === 'localhost' || env_1.ENV.REDIS_HOST === '127.0.0.1';
const isTls = env_1.ENV.REDIS_TLS ?? (!isLocal || env_1.ENV.REDIS_HOST.includes('upstash.io'));
exports.redisConnectionOptions = {
    host: env_1.ENV.REDIS_HOST,
    port: env_1.ENV.REDIS_PORT,
    password: env_1.ENV.REDIS_PASSWORD,
    ...(isTls ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
};
