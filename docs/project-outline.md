At a high level, you’ve got a classic client–server “backend-for-frontend” setup:
	•	Frontend: Vite + React + TypeScript (Bun runs the dev server)
	•	Backend: Express + TypeScript (run by Bun)
	•	External services: Discogs API + GetSongBPM API

I’ll break it down in terms of layers and data flow rather than just folders.

⸻

1. High-level layers

1) Frontend (Vite + React + TS)

Role:
Pure UI layer, never touches Discogs/GetSongBPM directly. It only talks to your own backend via /api/....

Main responsibilities:
	•	Display your vinyl collection as cards (or later, tables, charts).
	•	Allow filtering (by artist/title/year/etc.).
	•	Trigger BPM lookups for individual records.
	•	Maintain local UI state:
	•	records (collection from Discogs via your backend)
	•	bpmMap (BPM info per record, keyed by release id)
	•	filterText, loading flags, error states.

How it talks to the backend:
	•	Uses fetch("/api/collection") to get your records.
	•	Uses fetch("/api/bpm?song=...&artist=...") to get BPM/Key/etc.
	•	Vite’s dev server proxies /api to http://localhost:4000.

So from the React code, it feels like a single origin app.

⸻

2) Backend (Express + TS, run with Bun)

Role:
Acts as a gateway between your frontend and third-party APIs (Discogs + GetSongBPM). It hides secrets, normalizes responses, and gives the frontend a nice, simple JSON shape.

Main responsibilities:
	•	Read API keys/secrets from .env (Discogs token, username, GetSongBPM key).
	•	Implement REST-ish endpoints:
	•	GET /api/collection
	•	Calls Discogs
GET https://api.discogs.com/users/{username}/collection/folders/0/releases
	•	Maps Discogs’ JSON into a simpler structure:

{
  id: number;
  title: string;
  artist: string;
  label: string;
  year: number;
  coverImage: string;
}


	•	Returns { records, pagination } to the frontend.

	•	GET /api/bpm?song=...&artist=...
	•	Builds a lookup query for GetSongBPM:
song:${song} artist:${artist}
	•	Calls GetSongBPM search endpoint.
	•	Extracts a single result and normalizes it:

{
  id: string;
  title: string;
  tempo: number | string;
  key?: string;
  danceability?: number;
  acousticness?: number;
}


	•	Potential place for:
	•	Caching (to reduce API calls and speed things up).
	•	Rate limiting and basic auth if you expose this beyond your LAN.
	•	A real database later (to store your own curated metadata).

⸻

3) External APIs
	•	Discogs = source of truth for:
	•	What records you own.
	•	Titles, artists, labels, years, cover images.
	•	GetSongBPM = enrichment layer for:
	•	Tempo (BPM), musical key, and other audio features (danceability, etc.).

The frontend never sees these directly, only your backend does.

⸻

2. Project structure (concrete view)

Something like:

vinyl-dashboard/
  server/
    index.ts         # Express app (Bun entrypoint)
    tsconfig.json
    .env             # API keys, username, port, etc.
  client/
    vite.config.ts   # sets proxy to /api -> http://localhost:4000
    index.html
    src/
      main.tsx       # bootstraps React
      App.tsx        # dashboard UI
      api.ts         # small wrapper around fetch("/api/...")
      types.ts       # shared front-end types (VinylRecord, BpmInfo)
  package.json        # Bun scripts for dev:client and dev:server


⸻

3. Data flow (end-to-end)

Example: you open the dashboard in the browser.
	1.	Browser → Frontend:
You request http://localhost:5173 → Vite serves index.html + bundled React code.
	2.	React → Backend (collection):
App.tsx runs fetchCollection() on mount → GET /api/collection.
	3.	Backend → Discogs → Backend:
	•	Express receives /api/collection.
	•	Calls Discogs API using secret token.
	•	Normalizes the JSON.
	•	Sends { records: [...] } back to the browser.
	4.	React updates state:
	•	records state is set.
	•	UI renders cards for each record.
	5.	React → Backend (BPM lookup for one record):
	•	You click “Load BPM / key” on a record.
	•	fetchBpm(record.title, record.artist) → GET /api/bpm?song=...&artist=....
	6.	Backend → GetSongBPM → Backend:
	•	Express builds the lookup query, calls GetSongBPM.
	•	Normalizes the response.
	•	Sends BPM info back to the browser.
	7.	React updates bpmMap:
	•	bpmMap[record.id] is updated with tempo, key, etc.
	•	UI updates the card to show BPM, key, danceability, etc.

⸻

4. Where you can evolve the architecture

Once the basic flow works, you have clear hooks to extend:
	•	Backend layer:
	•	Add a small DB (SQLite/Postgres/etc.) to cache BPM results or store your own tags.
	•	Add a /api/stats endpoint that aggregates data (e.g., distribution of BPMs, most common labels).
	•	Shared types:
	•	Extract types to a shared package (packages/shared) and import into both client and server, so you don’t duplicate VinylRecord/BpmInfo types.
	•	Frontend layer:
	•	Introduce a state library later (Zustand, Redux, etc.) if the UI grows.
	•	Add views like:
	•	“By BPM range”
	•	“By label”
	•	“DJ-friendly crate” (subset of collection meeting BPM/key rules)

⸻
