# vinyl-dash

A dashboard for viewing your Discogs vinyl collection with BPM and key information.

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root with the following:

```env
# Discogs API Configuration
# Get your personal access token from: https://www.discogs.com/settings/developers
DISCOGS_TOKEN=your_discogs_personal_access_token_here
DISCOGS_USERNAME=your_discogs_username

# GetSongBPM API Configuration
# Get your API key from: https://getsongbpm.com/api
GETSONGBPM_API_KEY=your_getsongbpm_api_key_here

# Server Configuration
PORT=4000
```

**Important:** 
- Bun automatically loads `.env` files, so no need for `dotenv` package
- Never commit your `.env` file to version control

### 3. Get Your API Keys

#### Discogs API Token

1. Go to [Discogs Developer Settings](https://www.discogs.com/settings/developers)
2. Generate a new personal access token
3. Copy the token and add it to your `.env` file

#### GetSongBPM API Key

1. Go to [GetSongBPM API](https://getsongbpm.com/api)
2. Provide your website URL or app ID/package name
3. Provide a backlink URL to GetSongBPM.com (required - must be active)
4. Provide a valid email address
5. Copy the API key and add it to your `.env` file

**Important:** GetSongBPM requires a backlink to GetSongBPM.com in your application. Failure to include this may result in account suspension.

## Running the Application

### Development Mode

Run both frontend and backend:

```bash
bun run dev
```

Or run them separately:

```bash
# Terminal 1: Backend server
bun run dev:server

# Terminal 2: Frontend dev server
bun run dev:client
```

The frontend will be available at `http://localhost:5173` (Vite default)
The backend API will be available at `http://localhost:4000`

## Project Structure

- `client/` - Vite + React + TypeScript frontend
- `server/` - Express + TypeScript backend
- `docs/` - Documentation including Discogs API implementation guide

## Documentation

- [Project Outline](./docs/project-outline.md) - Architecture overview
- [Discogs API Implementation](./docs/discogs-api-implementation.md) - Detailed guide on Discogs API integration
- [GetSongBPM API Implementation](./docs/getsongbpm-api-implementation.md) - Detailed guide on GetSongBPM API integration
- [GetSongBPM API Registration Guide](./docs/getsongbpm-api-registration-guide.md) - Guide for registering and setting up GetSongBPM API

This project was created using `bun init` in bun v1.3.1. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Credits

BPM data provided by [GetSongBPM](https://getsongbpm.com)
