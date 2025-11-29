import express from 'express';
import cors from 'cors';
import { getCache, setCache, generateCacheKey } from './redis';
import { fetchDiscogs, fetchGetSongBPM } from './apiClient';

const app = express();
const PORT = process.env.PORT || 4000;

// Logging utility function
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

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Determine log level: treat "no data found" 404s as warnings
    let level: 'error' | 'warn' | 'info' = 'info';
    if (res.statusCode >= 500) {
      level = 'error';
    } else if (res.statusCode >= 400) {
      // For 404s on BPM endpoint, treat as warning (expected when no data found)
      if (res.statusCode === 404 && req.path === '/api/bpm' && res.locals.noDataFound) {
        level = 'warn';
      } else {
        level = 'error';
      }
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: 'HTTP Request',
      context: {
        method: req.method,
        path: req.path,
        query: req.query,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      },
    };
    
    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  });
  
  next();
});

app.use(cors());
app.use(express.json());

// Unhandled error middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logError('error', 'Unhandled error in request handler', {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
  }, err);
  
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Collection endpoint
app.get('/api/collection', async (req, res) => {
  try {
    const token = process.env.DISCOGS_TOKEN;
    const username = process.env.DISCOGS_USERNAME;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const perPage = req.query.per_page ? parseInt(req.query.per_page as string) : 50;

    if (!token || !username) {
      logError('error', 'Discogs API credentials not configured', {
        endpoint: '/api/collection',
        hasToken: !!token,
        hasUsername: !!username,
      });
      return res.status(500).json({ 
        error: 'Discogs API credentials not configured',
        message: 'Please set DISCOGS_TOKEN and DISCOGS_USERNAME in your .env file'
      });
    }

    // Validate pagination parameters
    if (page < 1) {
      logError('warn', 'Invalid pagination parameter: page', {
        endpoint: '/api/collection',
        page,
        username,
      });
      return res.status(400).json({ error: 'Page must be greater than 0' });
    }
    if (perPage < 1 || perPage > 100) {
      logError('warn', 'Invalid pagination parameter: per_page', {
        endpoint: '/api/collection',
        perPage,
        username,
      });
      return res.status(400).json({ error: 'per_page must be between 1 and 100' });
    }

    // Check cache first
    const cacheKey = generateCacheKey('collection', { username, page, perPage });
    try {
      const cached = await getCache<{ records: any[]; pagination: any }>(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    } catch (cacheError) {
      logError('warn', 'Cache get error in collection endpoint', {
        endpoint: '/api/collection',
        cacheKey,
        username,
        page,
        perPage,
      }, cacheError);
      // Continue without cache
    }

    const url = `https://api.discogs.com/users/${encodeURIComponent(username)}/collection/folders/0/releases?page=${page}&per_page=${perPage}`;
    const dedupeKey = `collection:${username}:${page}:${perPage}`;
    
    const response = await fetchDiscogs(url, {
      headers: {
        'Authorization': `Discogs token=${token}`,
        'User-Agent': 'VinylDash/1.0 +https://github.com/yourusername/vinyl-dash',
        'Accept': 'application/json',
      },
    }, dedupeKey);

    // Handle authentication errors
    if (response.status === 401) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid Discogs token. Please check your DISCOGS_TOKEN in .env'
      });
    }

    // Handle not found errors
    if (response.status === 404) {
      return res.status(404).json({ 
        error: 'Collection not found',
        message: `User "${username}" or collection folder not found`
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      logError('error', 'Discogs API error response', {
        endpoint: '/api/collection',
        status: response.status,
        statusText: response.statusText,
        username,
        page,
        perPage,
        errorText,
      });
      throw new Error(`Discogs API error: ${response.status} ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      logError('error', 'JSON parsing error in collection endpoint', {
        endpoint: '/api/collection',
        username,
        page,
        perPage,
      }, parseError);
      throw new Error('Failed to parse response from Discogs API');
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      logError('error', 'Invalid response format from Discogs API', {
        endpoint: '/api/collection',
        username,
        page,
        perPage,
        dataType: typeof data,
      });
      throw new Error('Invalid response format from Discogs API');
    }

    // Normalize Discogs response to our format
    const records = (data.releases || []).map((release: any) => {
      const basicInfo = release.basic_information || {};
      const artists = basicInfo.artists || [];
      const labels = basicInfo.labels || [];
      
      // Handle multiple artists (join with ", " or use first)
      const artist = artists.length > 0 
        ? artists.map((a: any) => a.name).join(', ')
        : 'Unknown Artist';
      
      // Use first label or fallback
      const label = labels.length > 0 ? labels[0].name : 'Unknown Label';
      
      return {
        id: release.id || basicInfo.id || 0,
        title: basicInfo.title || 'Unknown Title',
        artist: artist,
        label: label,
        year: basicInfo.year || null,
        coverImage: basicInfo.cover_image || basicInfo.thumb || '',
      };
    });

    const responseData = {
      records,
      pagination: {
        page: data.pagination?.page || page,
        perPage: data.pagination?.per_page || perPage,
        pages: data.pagination?.pages || 1,
        items: data.pagination?.items || 0,
      },
    };

    // Cache the response for 1 hour (3600 seconds)
    try {
      await setCache(cacheKey, responseData, 3600);
    } catch (cacheError) {
      logError('warn', 'Cache set error in collection endpoint', {
        endpoint: '/api/collection',
        cacheKey,
        username,
        page,
        perPage,
      }, cacheError);
      // Continue without caching
    }

    res.json(responseData);
  } catch (error) {
    logError('error', 'Error fetching collection', {
      endpoint: '/api/collection',
      query: req.query,
    }, error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return res.status(503).json({ 
          error: 'Service unavailable',
          message: 'Unable to reach Discogs API. Please check your internet connection.'
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch collection',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Release details endpoint
app.get('/api/release/:id', async (req, res) => {
  try {
    const releaseId = req.params.id;
    const token = process.env.DISCOGS_TOKEN;

    if (!token) {
      logError('error', 'Discogs API credentials not configured', {
        endpoint: '/api/release/:id',
        releaseId,
        hasToken: !!token,
      });
      return res.status(500).json({ 
        error: 'Discogs API credentials not configured',
        message: 'Please set DISCOGS_TOKEN in your .env file'
      });
    }

    // Validate release ID
    const id = parseInt(releaseId);
    if (isNaN(id) || id <= 0) {
      logError('warn', 'Invalid release ID parameter', {
        endpoint: '/api/release/:id',
        releaseId,
        parsedId: id,
      });
      return res.status(400).json({ error: 'Invalid release ID' });
    }

    // Check cache first
    const cacheKey = generateCacheKey('release', { id });
    try {
      const cached = await getCache<{ id: number; tracks: any[] }>(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    } catch (cacheError) {
      logError('warn', 'Cache get error in release endpoint', {
        endpoint: '/api/release/:id',
        cacheKey,
        releaseId: id,
      }, cacheError);
      // Continue without cache
    }

    const url = `https://api.discogs.com/releases/${id}`;
    const dedupeKey = `release:${id}`;
    
    const response = await fetchDiscogs(url, {
      headers: {
        'Authorization': `Discogs token=${token}`,
        'User-Agent': 'VinylDash/1.0 +https://github.com/yourusername/vinyl-dash',
        'Accept': 'application/json',
      },
    }, dedupeKey);

    // Handle authentication errors
    if (response.status === 401) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid Discogs token. Please check your DISCOGS_TOKEN in .env'
      });
    }

    // Handle not found errors
    if (response.status === 404) {
      return res.status(404).json({ 
        error: 'Release not found',
        message: `Release with ID ${releaseId} not found`
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      logError('error', 'Discogs API error response', {
        endpoint: '/api/release/:id',
        status: response.status,
        statusText: response.statusText,
        releaseId: id,
        errorText,
      });
      throw new Error(`Discogs API error: ${response.status} ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      logError('error', 'JSON parsing error in release endpoint', {
        endpoint: '/api/release/:id',
        releaseId: id,
      }, parseError);
      throw new Error('Failed to parse response from Discogs API');
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      logError('error', 'Invalid response format from Discogs API', {
        endpoint: '/api/release/:id',
        releaseId: id,
        dataType: typeof data,
      });
      throw new Error('Invalid response format from Discogs API');
    }

    // Extract and normalize tracklist
    const tracklist = (data.tracklist || []).map((track: any) => {
      return {
        title: track.title || 'Unknown Track',
        position: track.position || '',
        duration: track.duration || undefined,
      };
    });

    const responseData = {
      id: data.id || id,
      tracks: tracklist,
    };

    // Cache the response for 30 minutes (1800 seconds)
    try {
      await setCache(cacheKey, responseData, 1800);
    } catch (cacheError) {
      logError('warn', 'Cache set error in release endpoint', {
        endpoint: '/api/release/:id',
        cacheKey,
        releaseId: id,
      }, cacheError);
      // Continue without caching
    }

    res.json(responseData);
  } catch (error) {
    logError('error', 'Error fetching release details', {
      endpoint: '/api/release/:id',
      releaseId: req.params.id,
    }, error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return res.status(503).json({ 
          error: 'Service unavailable',
          message: 'Unable to reach Discogs API. Please check your internet connection.'
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch release details',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// BPM endpoint
app.get('/api/bpm', async (req, res) => {
  try {
    const { song, artist } = req.query;
    
    // Validate required parameters
    if (!song || !artist) {
      logError('warn', 'Missing required parameters in BPM endpoint', {
        endpoint: '/api/bpm',
        hasSong: !!song,
        hasArtist: !!artist,
        query: req.query,
      });
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Both song and artist parameters are required'
      });
    }

    // Trim whitespace from inputs
    const songTitle = (song as string).trim();
    const artistName = (artist as string).trim();

    if (!songTitle || !artistName) {
      logError('warn', 'Invalid parameters in BPM endpoint', {
        endpoint: '/api/bpm',
        song: songTitle,
        artist: artistName,
      });
      return res.status(400).json({ 
        error: 'Invalid parameters',
        message: 'Song and artist cannot be empty'
      });
    }

    // Check cache first (normalize to lowercase for consistent keys)
    const cacheKey = generateCacheKey('bpm', { 
      song: songTitle.toLowerCase(), 
      artist: artistName.toLowerCase() 
    });
    try {
      const cached = await getCache<{ id: string; title: string; tempo: number; key?: string; danceability?: number; acousticness?: number }>(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    } catch (cacheError) {
      logError('warn', 'Cache get error in BPM endpoint', {
        endpoint: '/api/bpm',
        cacheKey,
        song: songTitle,
        artist: artistName,
      }, cacheError);
      // Continue without cache
    }

    const apiKey = process.env.GETSONGBPM_API_KEY;
    
    if (!apiKey) {
      logError('error', 'GetSongBPM API key not configured', {
        endpoint: '/api/bpm',
        hasApiKey: !!apiKey,
        song: songTitle,
        artist: artistName,
      });
      return res.status(500).json({ 
        error: 'GetSongBPM API key not configured',
        message: 'Please set GETSONGBPM_API_KEY in your .env file'
      });
    }

    // Use the correct GetSongBPM API endpoint
    // Search by song title, then filter by artist
    const lookup = encodeURIComponent(songTitle);
    const url = `https://api.getsong.co/search/?type=song&lookup=${lookup}&api_key=${apiKey}`;
    const dedupeKey = `bpm:${songTitle.toLowerCase()}:${artistName.toLowerCase()}`;
    
    const response = await fetchGetSongBPM(url, {
      headers: {
        'User-Agent': 'VinylDash/1.0 +https://github.com/yourusername/vinyl-dash',
        'Accept': 'application/json',
      },
    }, dedupeKey);

    // Handle authentication errors
    if (response.status === 401) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid GetSongBPM API key. Please check your GETSONGBPM_API_KEY in .env'
      });
    }

    // Handle bad request
    if (response.status === 400) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Invalid search parameters'
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      logError('error', 'GetSongBPM API error response', {
        endpoint: '/api/bpm',
        status: response.status,
        statusText: response.statusText,
        song: songTitle,
        artist: artistName,
        errorText,
      });
      throw new Error(`GetSongBPM API error: ${response.status} ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      logError('error', 'JSON parsing error in BPM endpoint', {
        endpoint: '/api/bpm',
        song: songTitle,
        artist: artistName,
      }, parseError);
      throw new Error('Failed to parse response from GetSongBPM API');
    }

    // Validate response structure
    if (!data || typeof data !== 'object') {
      logError('error', 'Invalid response format from GetSongBPM API', {
        endpoint: '/api/bpm',
        song: songTitle,
        artist: artistName,
        dataType: typeof data,
      });
      throw new Error('Invalid response format from GetSongBPM API');
    }

    // Filter results by artist name (case-insensitive partial match)
    // Handle case where API returns {"search": {"error": "no result"}} instead of {"search": []}
    const searchResults = Array.isArray(data.search) ? data.search : [];

    const artistLower = artistName.toLowerCase();
    
    // Try to find exact or partial artist match
    let result = searchResults.find((item: any) => {
      const itemArtist = item.artist?.name?.toLowerCase() || '';
      return itemArtist.includes(artistLower) || artistLower.includes(itemArtist);
    });

    // Fallback to first result if no artist match found
    if (!result && searchResults.length > 0) {
      result = searchResults[0];
    }

    if (!result) {
      // Mark this as an expected "no data found" case for logging
      res.locals.noDataFound = true;
      return res.status(404).json({ 
        error: 'No BPM data found',
        message: `No BPM data found for "${songTitle}" by "${artistName}"`
      });
    }

    // Normalize response to our format
    const normalized = {
      id: result.id || '',
      title: result.title || songTitle,
      tempo: result.tempo || 0,
      key: result.key || undefined,
      danceability: result.danceability || undefined,
      acousticness: result.acousticness || undefined,
    };

    // Cache the response for 24 hours (86400 seconds)
    try {
      await setCache(cacheKey, normalized, 86400);
    } catch (cacheError) {
      logError('warn', 'Cache set error in BPM endpoint', {
        endpoint: '/api/bpm',
        cacheKey,
        song: songTitle,
        artist: artistName,
      }, cacheError);
      // Continue without caching
    }

    res.json(normalized);
  } catch (error) {
    logError('error', 'Error fetching BPM', {
      endpoint: '/api/bpm',
      query: req.query,
    }, error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return res.status(503).json({ 
          error: 'Service unavailable',
          message: 'Unable to reach GetSongBPM API. Please check your internet connection.'
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch BPM data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

