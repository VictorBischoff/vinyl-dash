import type { CollectionResponse, BpmInfo } from './types';

export async function fetchCollection(page = 1, perPage = 50): Promise<CollectionResponse> {
  const response = await fetch(`/api/collection?page=${page}&per_page=${perPage}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch collection: ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchBpm(song: string, artist: string): Promise<BpmInfo> {
  const params = new URLSearchParams({
    song,
    artist,
  });
  
  const response = await fetch(`/api/bpm?${params}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch BPM data: ${response.statusText}`);
  }
  
  return response.json();
}

