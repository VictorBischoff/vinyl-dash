import Redis from 'ioredis';

// Logging utility for Redis
function logError(level: 'error' | 'warn', message: string, context: Record<string, any> = {}, error?: Error | unknown) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : error,
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else {
    console.warn(JSON.stringify(logEntry));
  }
}

// Initialize Redis client
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redis: Redis | null = null;

try {
  redis = new Redis(redisUrl, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    logError('warn', 'Redis connection error', {
      operation: 'redis_connection',
      redisUrl: redisUrl.replace(/:[^:@]+@/, ':****@'), // Mask password in URL
      status: redis?.status,
    }, err);
    // Don't throw - allow graceful degradation
  });

  redis.on('connect', () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Redis connected',
      context: {
        operation: 'redis_connection',
        redisUrl: redisUrl.replace(/:[^:@]+@/, ':****@'), // Mask password in URL
        status: redis?.status,
      },
    }));
  });

  // Attempt to connect
  redis.connect().catch((err) => {
    logError('warn', 'Redis connection failed, continuing without cache', {
      operation: 'redis_connect',
      redisUrl: redisUrl.replace(/:[^:@]+@/, ':****@'), // Mask password in URL
    }, err);
  });
} catch (error) {
  logError('warn', 'Redis initialization failed, continuing without cache', {
    operation: 'redis_init',
    redisUrl: redisUrl.replace(/:[^:@]+@/, ':****@'), // Mask password in URL
  }, error);
  redis = null;
}

/**
 * Generate a consistent cache key from endpoint and parameters
 */
export function generateCacheKey(endpoint: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${params[key]}`)
    .join(':');
  return `${endpoint}:${sortedParams}`;
}

/**
 * Retrieve cached data by key
 * Returns null if cache miss or Redis unavailable
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) {
    return null;
  }

  try {
    const cached = await redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch (parseError) {
        logError('error', 'Cache JSON parsing error', {
          operation: 'getCache',
          key,
          operationType: 'parse',
        }, parseError);
        return null;
      }
    }
    return null;
  } catch (error) {
    logError('warn', 'Cache get error', {
      operation: 'getCache',
      key,
      operationType: 'get',
      redisStatus: redis?.status,
    }, error);
    return null;
  }
}

/**
 * Store data in cache with TTL (time to live in seconds)
 * Silently fails if Redis unavailable
 */
export async function setCache(key: string, value: any, ttl: number): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttl, serialized);
  } catch (error) {
    let valueSize = 'unknown';
    try {
      const serialized = JSON.stringify(value);
      valueSize = serialized.length.toString();
    } catch {
      // Ignore serialization error for logging
    }
    logError('warn', 'Cache set error', {
      operation: 'setCache',
      key,
      operationType: 'setex',
      ttl,
      valueSize,
      redisStatus: redis?.status,
    }, error);
    // Don't throw - graceful degradation
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redis !== null && redis.status === 'ready';
}

/**
 * Close Redis connection (useful for cleanup)
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

