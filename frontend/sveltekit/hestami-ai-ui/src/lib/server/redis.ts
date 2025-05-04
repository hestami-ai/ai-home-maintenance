import { createClient, type RedisClientType } from 'redis';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

// Session configuration
export const SESSION_COOKIE_NAME = 'hestami_session';
export const SESSION_DURATION = 60 * 60 * 24 * 7; // 1 week in seconds

// Redis connection settings
const REDIS_URL = env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client
let redisClient: RedisClientType | null = null;

/**
 * Get Redis client instance (singleton pattern)
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries: number) => {
          // Exponential backoff with max 10 seconds
          const delay = Math.min(Math.pow(2, retries) * 100, 10000);
          return delay;
        }
      }
    });

    // Log Redis connection events
    // Use type assertion to access event emitter methods
    (redisClient as any).on('error', (err: Error) => {
      console.error('Redis connection error:', err);
    });

    (redisClient as any).on('connect', () => {
      console.log('Redis connected successfully');
    });

    (redisClient as any).on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });

    // Connect to Redis
    await redisClient.connect();
  }

  return redisClient;
}

/**
 * Close Redis connection (useful for cleanup)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
