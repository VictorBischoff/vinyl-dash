import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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
      return res.status(500).json({ 
        error: 'Discogs API credentials not configured',
        message: 'Please set DISCOGS_TOKEN and DISCOGS_USERNAME in your .env file'
      });
    }

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({ error: 'Page must be greater than 0' });
    }
    if (perPage < 1 || perPage > 100) {
      return res.status(400).json({ error: 'per_page must be between 1 and 100' });
    }

    const url = `https://api.discogs.com/users/${encodeURIComponent(username)}/collection/folders/0/releases?page=${page}&per_page=${perPage}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Discogs token=${token}`,
        'User-Agent': 'VinylDash/1.0 +https://github.com/yourusername/vinyl-dash',
        'Accept': 'application/json',
      },
    });

    // Handle rate limiting (429 Too Many Requests)
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Discogs API rate limit reached. Please try again later.',
        retryAfter: retryAfter ? parseInt(retryAfter) : 60
      });
    }

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
      console.error(`Discogs API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Discogs API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data || typeof data !== 'object') {
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

    res.json({
      records,
      pagination: {
        page: data.pagination?.page || page,
        perPage: data.pagination?.per_page || perPage,
        pages: data.pagination?.pages || 1,
        items: data.pagination?.items || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching collection:', error);
    
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

// BPM endpoint
app.get('/api/bpm', async (req, res) => {
  try {
    const { song, artist } = req.query;
    
    // Validate required parameters
    if (!song || !artist) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Both song and artist parameters are required'
      });
    }

    // Trim whitespace from inputs
    const songTitle = (song as string).trim();
    const artistName = (artist as string).trim();

    if (!songTitle || !artistName) {
      return res.status(400).json({ 
        error: 'Invalid parameters',
        message: 'Song and artist cannot be empty'
      });
    }

    const apiKey = process.env.GETSONGBPM_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'GetSongBPM API key not configured',
        message: 'Please set GETSONGBPM_API_KEY in your .env file'
      });
    }

    // Use the correct GetSongBPM API endpoint
    // Search by song title, then filter by artist
    const lookup = encodeURIComponent(songTitle);
    const url = `https://api.getsong.co/search/?type=song&lookup=${lookup}&api_key=${apiKey}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VinylDash/1.0 +https://github.com/yourusername/vinyl-dash',
        'Accept': 'application/json',
      },
    });

    // Handle rate limiting (429 Too Many Requests)
    if (response.status === 429) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'GetSongBPM API rate limit reached (3,000 requests/hour). Please try again later.'
      });
    }

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
      console.error(`GetSongBPM API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`GetSongBPM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format from GetSongBPM API');
    }

    // Filter results by artist name (case-insensitive partial match)
    const searchResults = data.search || [];
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

    res.json(normalized);
  } catch (error) {
    console.error('Error fetching BPM:', error);
    
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

