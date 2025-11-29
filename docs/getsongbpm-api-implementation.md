# GetSongBPM API Implementation Guide

This document explains how the GetSongBPM API is correctly implemented in this project.

## Overview

The GetSongBPM API is used to fetch BPM (beats per minute), key, and other musical metadata for songs. All API calls are made from the backend server (`server/index.ts`) to keep API credentials secure.

## Authentication

### API Key

GetSongBPM uses **API Key** authentication.

1. **Get your API key:**
   - Go to [GetSongBPM API](https://getsongbpm.com/api)
   - Provide your website URL or app ID/package name
   - Provide a backlink URL to GetSongBPM.com (required)
   - Provide a valid email address
   - Ensure the backlink is active before submitting your request

2. **Set environment variables:**
   Create a `.env` file in the project root with:
   ```env
   GETSONGBPM_API_KEY=your_getsongbpm_api_key_here
   PORT=4000
   ```

3. **Authentication Methods:**
   The API key can be passed in two ways:
   - **Query parameter:** `api_key=your_key_here`
   - **Header:** `X-API-KEY: your_key_here`
   
   This implementation uses the query parameter method.

## API Endpoints Used

### Search Endpoint

**Endpoint:** `GET /api/bpm`

**GetSongBPM API Call:**
```
GET https://api.getsong.co/search/?type=song&lookup={song_title}&api_key={api_key}
```

**Query Parameters:**
- `song` (required): Song title
- `artist` (required): Artist name

**Backend Implementation:**
The backend searches for the song by title, then filters results by artist to find the best match.

**Response Normalization:**

The GetSongBPM API returns a search results array. We normalize it to a simpler format:

```typescript
// GetSongBPM Response Structure
{
  search: [
    {
      id: string,
      title: string,
      artist: {
        id: string,
        name: string
      },
      tempo: number,
      key: string,
      danceability: number,
      acousticness: number,
      // ... other fields
    }
  ]
}

// Normalized to:
{
  id: string,
  title: string,
  tempo: number,
  key?: string,
  danceability?: number,
  acousticness?: number
}
```

## Error Handling

### Rate Limiting

GetSongBPM enforces rate limits:
- **Limit:** 3,000 requests per hour
- **Exceeding limit:** API key is blocked for one hour

**Implementation:**
- Check for rate limit responses
- Return appropriate error messages to the client
- Log rate limit hits for monitoring

### Common Error Codes

| Status | Meaning | Handling |
|--------|---------|----------|
| 200 | Success | Return normalized data |
| 400 | Bad Request | Invalid parameters - check song/artist |
| 401 | Unauthorized | Invalid API key - check GETSONGBPM_API_KEY |
| 404 | Not Found | No BPM data found for this song |
| 429 | Rate Limited | Too many requests - wait before retrying |
| 500+ | Server Error | Log and return generic error |

## Best Practices

### 1. Environment Variables

- **Never commit `.env` files** to version control
- Use `.env.example` as a template:
  ```env
  GETSONGBPM_API_KEY=your_api_key_here
  PORT=4000
  ```

### 2. Input Validation

- Validate that both `song` and `artist` parameters are provided
- URL-encode search terms to handle special characters
- Trim whitespace from input parameters

### 3. Response Validation

- Check response structure before parsing
- Handle empty search results gracefully
- Provide fallback values for optional fields (key, danceability, etc.)
- Filter results by artist name when multiple matches exist

### 4. Error Messages

- Provide helpful error messages to frontend
- Log detailed errors server-side
- Don't expose sensitive information (API keys, etc.)

### 5. Backlink Requirement

**Important:** GetSongBPM requires a backlink to GetSongBPM.com in your application. Failure to include this may result in account suspension without notice.

- Add a backlink to GetSongBPM.com in your application
- Keep the backlink active and visible
- This is mandatory for API usage

## Search Strategy

When searching for BPM data:

1. **Primary search:** Search by song title using the `lookup` parameter
2. **Filtering:** Filter results by artist name to find the best match
3. **Fallback:** If no exact match, return the first result (may need user confirmation)
4. **Error handling:** Return 404 if no results found

## Testing

### Manual Testing

1. **Test with valid parameters:**
   ```bash
   curl "http://localhost:4000/api/bpm?song=Bohemian%20Rhapsody&artist=Queen"
   ```

2. **Test error handling:**
   - Remove `GETSONGBPM_API_KEY` from `.env` → Should return 500
   - Use invalid API key → Should return 401
   - Use non-existent song → Should return 404
   - Omit song or artist parameter → Should return 400

### Rate Limit Testing

To test rate limiting (be careful not to abuse):
- Make 3,000+ requests in an hour
- Should receive 429 status after limit

## Future Improvements

1. **Caching:**
   - Cache BPM data to reduce API calls
   - Implement cache invalidation strategy
   - Store BPM data with vinyl records

2. **Rate Limit Handling:**
   - Implement exponential backoff
   - Queue requests when rate limited
   - Track request count per hour

3. **Better Matching:**
   - Use fuzzy matching for artist names
   - Handle multiple artists (featuring, etc.)
   - Allow user to select from multiple matches

4. **Batch Processing:**
   - Fetch BPM for multiple songs in one request
   - Process collection in batches
   - Show progress to user

5. **Error Recovery:**
   - Retry failed requests with backoff
   - Fallback to cached data if available
   - Graceful degradation when API is unavailable

## Resources

- [GetSongBPM API Documentation](https://getsongbpm.com/api)
- [GetSongBPM Website](https://getsongbpm.com)

