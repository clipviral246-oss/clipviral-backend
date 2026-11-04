import { RedisOptions } from 'ioredis';
import { ENV } from './env';

// Upstash and cloud-hosted Redis require a secure TLS connection.
// Safely enable tls: {} for Upstash / remote hosts while preserving plain TCP for local dev.
const isLocal = ENV.REDIS_HOST === 'localhost' || ENV.REDIS_HOST === '127.0.0.1';
const isTls = ENV.REDIS_TLS ?? (!isLocal || ENV.REDIS_HOST.includes('upstash.io'));

export const redisConnectionOptions: RedisOptions = {
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  password: ENV.REDIS_PASSWORD,
  ...(isTls ? { tls: {} } : {}),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};
