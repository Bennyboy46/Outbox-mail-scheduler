import Redis from 'ioredis';

const redisUrl =
  process.env.REDIS_URL ||
  `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on('error', (error) => {
  console.error('[Redis] Connection error:', error.message);
});

export default redis;
