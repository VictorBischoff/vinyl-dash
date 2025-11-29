// Request queue with deduplication, batching, and exponential backoff

import { canMakeRequest, recordRequest } from './rateLimiter';

type API = 'discogs' | 'getsongbpm';

interface QueuedRequest<T> {
  requestFn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  dedupeKey?: string;
  retryCount: number;
  retryAfter?: number;
}

interface InFlightRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const queues = new Map<API, QueuedRequest<any>[]>();
const inFlightRequests = new Map<string, InFlightRequest<any>>();
const batchSize = 5;
const maxRetries = 5;
const baseBackoffDelay = 1000; // 1 second
const maxBackoffDelay = 60000; // 60 seconds

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
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(retryCount: number, retryAfter?: number): number {
  // If Retry-After header is present, use that (convert seconds to ms)
  if (retryAfter !== undefined) {
    return retryAfter * 1000;
  }

  // Exponential backoff: min(baseDelay * 2^retryCount, maxDelay)
  const delay = Math.min(baseBackoffDelay * Math.pow(2, retryCount), maxBackoffDelay);
  return delay;
}

/**
 * Get in-flight request if it exists
 */
export function getInFlightRequest<T>(key: string): Promise<T> | null {
  const inFlight = inFlightRequests.get(key);
  if (inFlight) {
    // Clean up if request is too old (5 minutes)
    const age = Date.now() - inFlight.timestamp;
    if (age > 5 * 60 * 1000) {
      inFlightRequests.delete(key);
      return null;
    }
    return inFlight.promise;
  }
  return null;
}

/**
 * Process a batch of requests for a given API
 */
async function processBatch(api: API): Promise<void> {
  const queue = queues.get(api) || [];
  
  if (queue.length === 0) {
    return;
  }

  // Get batch of requests (up to batchSize)
  const batch = queue.splice(0, batchSize);
  
  // Process batch sequentially to respect rate limits
  for (const queuedRequest of batch) {
    try {
      // Check rate limit
      const limiterName = api;
      const { allowed, waitMs } = canMakeRequest(limiterName);
      
      if (!allowed && waitMs !== undefined) {
        // Wait before making request
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }

      // Make the request
      recordRequest(limiterName);
      const result = await queuedRequest.requestFn();
      
      // Clean up deduplication if needed
      if (queuedRequest.dedupeKey) {
        inFlightRequests.delete(queuedRequest.dedupeKey);
      }
      
      queuedRequest.resolve(result);
    } catch (error) {
      // Check if it's a 429 error and we should retry
      const isRateLimitError = error instanceof Error && 
        (error.message.includes('429') || error.message.includes('Rate limit'));
      
      if (isRateLimitError && queuedRequest.retryCount < maxRetries) {
        // Extract retryAfter from error if available
        const errorWithRetryAfter = error as Error & { retryAfter?: number };
        const retryAfter = errorWithRetryAfter.retryAfter || queuedRequest.retryAfter;
        
        // Calculate backoff delay
        const delay = calculateBackoffDelay(queuedRequest.retryCount, retryAfter);
        
        // Re-queue with incremented retry count and preserved retryAfter
        const retryRequest: QueuedRequest<any> = {
          ...queuedRequest,
          retryCount: queuedRequest.retryCount + 1,
          retryAfter: retryAfter,
        };
        
        // Add to front of queue after delay
        setTimeout(() => {
          const currentQueue = queues.get(api) || [];
          currentQueue.unshift(retryRequest);
          queues.set(api, currentQueue);
          processBatch(api).catch(err => {
            logError('error', 'Error processing batch after retry', { api }, err);
          });
        }, delay);
      } else {
        // Clean up deduplication
        if (queuedRequest.dedupeKey) {
          inFlightRequests.delete(queuedRequest.dedupeKey);
        }
        
        queuedRequest.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // Process next batch if queue has more items
  if (queues.get(api)?.length > 0) {
    // Small delay before next batch to avoid overwhelming
    setTimeout(() => {
      processBatch(api).catch(err => {
        logError('error', 'Error processing next batch', { api }, err);
      });
    }, 100);
  }
}

/**
 * Enqueue a request with rate limiting, deduplication, and retry logic
 */
export function enqueueRequest<T>(
  api: API,
  requestFn: () => Promise<T>,
  dedupeKey?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // Check for duplicate in-flight request
    if (dedupeKey) {
      const existing = getInFlightRequest<T>(dedupeKey);
      if (existing) {
        return existing.then(resolve).catch(reject);
      }
    }

    const queuedRequest: QueuedRequest<T> = {
      requestFn,
      resolve,
      reject,
      dedupeKey,
      retryCount: 0,
    };

    // Track as in-flight if dedupe key provided
    if (dedupeKey) {
      const promise = new Promise<T>((innerResolve, innerReject) => {
        queuedRequest.resolve = (value) => {
          innerResolve(value);
          resolve(value);
        };
        queuedRequest.reject = (error) => {
          innerReject(error);
          reject(error);
        };
      });
      
      inFlightRequests.set(dedupeKey, {
        promise,
        timestamp: Date.now(),
      });
    }

    // Add to queue
    const queue = queues.get(api) || [];
    queue.push(queuedRequest);
    queues.set(api, queue);

    // Start processing if queue was empty
    if (queue.length === 1) {
      processBatch(api).catch(err => {
        logError('error', 'Error processing batch', { api }, err);
      });
    }
  });
}

/**
 * Set retry-after value for a queued request (used when 429 is detected)
 */
export function setRetryAfter(api: API, dedupeKey: string, retryAfter: number): void {
  const queue = queues.get(api) || [];
  const request = queue.find(req => req.dedupeKey === dedupeKey);
  if (request) {
    request.retryAfter = retryAfter;
  }
}

