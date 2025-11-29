# Discogs API Implementation Guide

This document explains how the Discogs API is correctly implemented in this project.

## Overview

The Discogs API is used to fetch your personal vinyl collection. All API calls are made from the backend server (`server/index.ts`) to keep API credentials secure.

## Authentication

### Personal Access Token

Discogs uses **Personal Access Token** authentication for accessing your own data. This is the recommended method for personal applications.

1. **Get your token:**
   - Go to [Discogs Developer Settings](https://www.discogs.com/settings/developers)
   - Generate a new personal access token
   - Copy the token (you won't be able to see it again)

2. **Set environment variables:**
   Create a `.env` file in the `server/` directory (or project root) with:
   ```env
   DISCOGS_TOKEN=your_personal_access_token_here
   DISCOGS_USERNAME=your_discogs_username
   PORT=4000
   ```

3. **Authentication Header Format:**
   ```typescript
   headers: {
     'Authorization': `Discogs token=${token}`,
     'User-Agent': 'VinylDash/1.0 +https://github.com/yourusername/vinyl-dash',
     'Accept': 'application/json',
   }
   ```

   **Important:**
   - The User-Agent must be unique and identify your application
   - Include a contact URL (GitHub repo, website, etc.)
   - Discogs uses this to identify and contact you if needed

## API Endpoints Used

### Collection Endpoint

**Endpoint:** `GET /api/collection`

**Discogs API Call:**
```
GET https://api.discogs.com/users/{username}/collection/folders/0/releases?page={page}&per_page={per_page}
```

**Query Parameters:**
- `page` (optional, default: 1): Page number (1-indexed)
- `per_page` (optional, default: 50): Items per page (1-100)

**Response Normalization:**

The Discogs API returns a complex nested structure. We normalize it to a simpler format:

```typescript
// Discogs Response Structure
{
  releases: [
    {
      id: number,
      basic_information: {
        id: number,
        title: string,
        artists: [{ name: string }],
        labels: [{ name: string }],
        year: number,
        cover_image: string,
        thumb: string
      }
    }
  ],
  pagination: {
    page: number,
    per_page: number,
    pages: number,
    items: number
  }
}

// Normalized to:
{
  records: [
    {
      id: number,
      title: string,
      artist: string,  // Multiple artists joined with ", "
      label: string,
      year: number | null,
      coverImage: string
    }
  ],
  pagination: {
    page: number,
    perPage: number,
    pages: number,
    items: number
  }
}
```

## Error Handling

### Rate Limiting

Discogs enforces rate limits:
- **Authenticated requests:** 60 requests per minute
- **Unauthenticated requests:** 25 requests per minute

**Implementation:**
- Check for `429 Too Many Requests` status
- Return `Retry-After` header value to the client
- Log rate limit hits for monitoring

### Common Error Codes

| Status | Meaning | Handling |
|--------|---------|----------|
| 200 | Success | Return normalized data |
| 401 | Unauthorized | Invalid token - check DISCOGS_TOKEN |
| 404 | Not Found | User or collection doesn't exist |
| 429 | Rate Limited | Return retry-after information |
| 500+ | Server Error | Log and return generic error |

## Best Practices

### 1. Environment Variables

- **Never commit `.env` files** to version control
- Use `.env.example` as a template:
  ```env
  DISCOGS_TOKEN=your_token_here
  DISCOGS_USERNAME=your_username
  PORT=4000
  ```

### 2. Input Validation

- Validate pagination parameters:
  - `page` must be >= 1
  - `per_page` must be between 1 and 100
- URL-encode username to handle special characters

### 3. Response Validation

- Check response structure before parsing
- Handle missing or null fields gracefully
- Provide fallback values for optional fields

### 4. Error Messages

- Provide helpful error messages to frontend
- Log detailed errors server-side
- Don't expose sensitive information (tokens, etc.)

### 5. User-Agent String

Format: `AppName/Version +ContactURL`

Example: `VinylDash/1.0 +https://github.com/yourusername/vinyl-dash`

This helps Discogs:
- Identify your application
- Contact you if there are issues
- Monitor API usage

## Testing

### Manual Testing

1. **Test with valid credentials:**
   ```bash
   curl http://localhost:4000/api/collection?page=1&per_page=10
   ```

2. **Test error handling:**
   - Remove `DISCOGS_TOKEN` from `.env` → Should return 500
   - Use invalid token → Should return 401
   - Use invalid username → Should return 404

### Rate Limit Testing

To test rate limiting (be careful not to abuse):
- Make 60+ requests in quick succession
- Should receive 429 status after limit

## Future Improvements

1. **Caching:**
   - Cache collection data to reduce API calls
   - Implement cache invalidation strategy

2. **Rate Limit Handling:**
   - Implement exponential backoff
   - Queue requests when rate limited

3. **Pagination:**
   - Auto-fetch all pages if needed
   - Stream results to frontend

4. **Error Recovery:**
   - Retry failed requests with backoff
   - Fallback to cached data if available

## Resources

- [Discogs API Documentation](https://www.discogs.com/developers/)
- [Discogs API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use)
- [Discogs Developer Settings](https://www.discogs.com/settings/developers)

