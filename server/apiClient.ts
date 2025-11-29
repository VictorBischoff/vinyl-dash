// API client wrapper with rate limiting, queuing, and retry logic

import { enqueueRequest, setRetryAfter } from './requestQueue';

type API = 'discogs' | 'getsongbpm';

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
 * Generate a deduplication key from URL and options
 */
function generateDedupeKey(url: string, options?: RequestInit): string {
  const method = options?.method || 'GET';
  const body = options?.body ? String(options.body) : '';
  return `${method}:${url}:${body}`;
}

/**
 * Fetch with rate limiting, queuing, and automatic retry
 */
export async function fetchWithRateLimit(
  url: string,
  options: RequestInit,
  api: API,
  dedupeKey?: string
): Promise<Response> {
  // Generate dedupe key if not provided
  const key = dedupeKey || generateDedupeKey(url, options);

  return enqueueRequest(api, async () => {
    const response = await fetch(url, options);

    // Handle 429 rate limit errors
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      
      // Create error with retryAfter information
      const error = new Error(`Rate limit exceeded (429). Retry-After: ${retryAfter || 'unknown'}`) as Error & { retryAfter?: number };
      error.retryAfter = retryAfter;
      
      // Set retryAfter in queue if key is provided
      if (retryAfter !== undefined && key) {
        setRetryAfter(api, key, retryAfter);
      }

      // Throw error to trigger retry logic in queue
      throw error;
    }

    return response;
  }, key);
}

/**
 * Fetch with rate limiting (simplified version for backward compatibility)
 */
export async function fetchDiscogs(url: string, options: RequestInit, dedupeKey?: string): Promise<Response> {
  return fetchWithRateLimit(url, options, 'discogs', dedupeKey);
}

/**
 * Fetch with rate limiting for GetSongBPM
 */
export async function fetchGetSongBPM(url: string, options: RequestInit, dedupeKey?: string): Promise<Response> {
  return fetchWithRateLimit(url, options, 'getsongbpm', dedupeKey);
}

