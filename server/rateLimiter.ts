// Rate limiter using sliding window algorithm
// Supports multiple rate limiters for different APIs

interface RateLimiter {
  name: string;
  maxRequests: number;
  windowMs: number;
  timestamps: number[];
}

const limiters = new Map<string, RateLimiter>();

// Logging utility
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

/**
 * Create or get a rate limiter
 */
export function createRateLimiter(name: string, maxRequests: number, windowMs: number): RateLimiter {
  if (limiters.has(name)) {
    return limiters.get(name)!;
  }

  const limiter: RateLimiter = {
    name,
    maxRequests,
    windowMs,
    timestamps: [],
  };

  limiters.set(name, limiter);
  return limiter;
}

/**
 * Check if a request can be made and return wait time if needed
 */
export function canMakeRequest(limiterName: string): { allowed: boolean; waitMs?: number } {
  const limiter = limiters.get(limiterName);
  
  if (!limiter) {
    logError('warn', 'Rate limiter not found', { limiterName });
    return { allowed: true }; // Allow if limiter doesn't exist
  }

  const now = Date.now();
  const windowStart = now - limiter.windowMs;

  // Clean up old timestamps outside the window
  limiter.timestamps = limiter.timestamps.filter(ts => ts > windowStart);

  // Check if we're under the limit
  if (limiter.timestamps.length < limiter.maxRequests) {
    return { allowed: true };
  }

  // Calculate wait time until oldest request expires
  const oldestTimestamp = limiter.timestamps[0];
  const waitMs = Math.max(0, oldestTimestamp + limiter.windowMs - now);

  return { allowed: false, waitMs };
}

/**
 * Record a request for rate limiting
 */
export function recordRequest(limiterName: string): void {
  const limiter = limiters.get(limiterName);
  
  if (!limiter) {
    logError('warn', 'Rate limiter not found when recording request', { limiterName });
    return;
  }

  const now = Date.now();
  limiter.timestamps.push(now);

  // Clean up old timestamps (keep array size manageable)
  const windowStart = now - limiter.windowMs;
  limiter.timestamps = limiter.timestamps.filter(ts => ts > windowStart);
}

/**
 * Initialize default rate limiters
 */
export function initializeRateLimiters(): void {
  // Discogs: 25 requests per minute (conservative limit)
  createRateLimiter('discogs', 25, 60 * 1000);
  
  // GetSongBPM: 50 requests per minute (3000/hour = 50/min)
  createRateLimiter('getsongbpm', 50, 60 * 1000);
}

// Initialize on module load
initializeRateLimiters();

