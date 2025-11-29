import type { CollectionResponse, BpmInfo, ReleaseDetailsResponse, VinylRecord } from './types';

// In-flight request tracking for deduplication
const inFlightRequests = new Map<string, Promise<any>>();

// Client-side logging utility
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
 * Get or create a request, preventing duplicates
 */
function getOrCreateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
  // Check if request is already in flight
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // Create new request
  const promise = requestFn()
    .then((result) => {
      inFlightRequests.delete(key);
      return result;
    })
    .catch((error) => {
      inFlightRequests.delete(key);
      throw error;
    });

  inFlightRequests.set(key, promise);
  return promise;
}

export async function fetchCollection(page = 1, perPage = 50): Promise<CollectionResponse> {
  try {
    const response = await fetch(`/api/collection?page=${page}&per_page=${perPage}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      logError('error', 'Failed to fetch collection', {
        endpoint: '/api/collection',
        status: response.status,
        statusText: response.statusText,
        page,
        perPage,
        errorText,
      });
      throw new Error(`Failed to fetch collection: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to fetch collection')) {
      throw error; // Re-throw if we already logged it
    }
    logError('error', 'Error in fetchCollection', {
      endpoint: '/api/collection',
      page,
      perPage,
    }, error);
    throw error;
  }
}

export async function fetchAllCollectionPages(perPage = 50): Promise<CollectionResponse> {
  try {
    // Fetch page 1 to get pagination metadata
    const firstPage = await fetchCollection(1, perPage);
    const totalPages = firstPage.pagination.pages;
    
    // If only one page, return it immediately
    if (totalPages <= 1) {
      return firstPage;
    }
    
    // Fetch all remaining pages sequentially
    const allRecords = [...firstPage.records];
    const pagePromises: Promise<CollectionResponse>[] = [];
    
    for (let page = 2; page <= totalPages; page++) {
      pagePromises.push(fetchCollection(page, perPage));
    }
    
    // Wait for all pages to load
    const remainingPages = await Promise.all(pagePromises);
    
    // Combine all records
    for (const pageData of remainingPages) {
      allRecords.push(...pageData.records);
    }
    
    // Deduplicate records by ID (keep first occurrence of each unique ID)
    const uniqueRecordsMap = new Map<number, VinylRecord>();
    for (const record of allRecords) {
      if (!uniqueRecordsMap.has(record.id)) {
        uniqueRecordsMap.set(record.id, record);
      }
    }
    const uniqueRecords = Array.from(uniqueRecordsMap.values());
    
    // Return combined result with updated pagination info
    return {
      records: uniqueRecords,
      pagination: {
        page: 1,
        perPage: perPage,
        pages: totalPages,
        items: firstPage.pagination.items,
      },
    };
  } catch (error) {
    logError('error', 'Error in fetchAllCollectionPages', {
      perPage,
    }, error);
    throw error;
  }
}

export async function fetchReleaseDetails(releaseId: number): Promise<ReleaseDetailsResponse> {
  const dedupeKey = `release:${releaseId}`;
  
  return getOrCreateRequest(dedupeKey, async () => {
    try {
      const response = await fetch(`/api/release/${releaseId}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        logError('error', 'Failed to fetch release details', {
          endpoint: '/api/release/:id',
          status: response.status,
          statusText: response.statusText,
          releaseId,
          errorText,
        });
        throw new Error(`Failed to fetch release details: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to fetch release details')) {
        throw error; // Re-throw if we already logged it
      }
      logError('error', 'Error in fetchReleaseDetails', {
        endpoint: '/api/release/:id',
        releaseId,
      }, error);
      throw error;
    }
  });
}

export async function fetchBpm(song: string, artist: string): Promise<BpmInfo> {
  // Normalize for deduplication (lowercase, trimmed)
  const normalizedSong = song.trim().toLowerCase();
  const normalizedArtist = artist.trim().toLowerCase();
  const dedupeKey = `bpm:${normalizedSong}:${normalizedArtist}`;
  
  return getOrCreateRequest(dedupeKey, async () => {
    try {
      const params = new URLSearchParams({
        song,
        artist,
      });
      
      const response = await fetch(`/api/bpm?${params}`);
      
      if (!response.ok) {
        // Try to parse error response as JSON
        let errorData: { error?: string; message?: string } = {};
        try {
          const errorText = await response.text();
          errorData = JSON.parse(errorText);
        } catch {
          // If parsing fails, use empty object
        }
        
        // Handle "no data found" case more gracefully
        if (response.status === 404 && errorData.error === 'No BPM data found') {
          // Log as warning instead of error since this is expected behavior
          logError('warn', 'No BPM data found', {
            endpoint: '/api/bpm',
            song,
            artist,
            message: errorData.message,
          });
          // Throw a more specific error that can be handled by the caller
          throw new Error(`No BPM data found for "${song}" by "${artist}"`);
        }
        
        // For other errors, log as error
        logError('error', 'Failed to fetch BPM data', {
          endpoint: '/api/bpm',
          status: response.status,
          statusText: response.statusText,
          song,
          artist,
          errorData,
        });
        throw new Error(`Failed to fetch BPM data: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      // Re-throw errors that we've already logged/processed
      if (error instanceof Error && (
        error.message.includes('Failed to fetch BPM data') ||
        error.message.includes('No BPM data found')
      )) {
        throw error;
      }
      logError('error', 'Error in fetchBpm', {
        endpoint: '/api/bpm',
        song,
        artist,
      }, error);
      throw error;
    }
  });
}

