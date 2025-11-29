export interface VinylRecord {
  id: number;
  title: string;
  artist: string;
  label: string;
  year: number | null;
  coverImage: string;
}

export interface BpmInfo {
  id: string;
  title: string;
  tempo: number | string;
  key?: string;
  danceability?: number;
  acousticness?: number;
}

export interface CollectionResponse {
  records: VinylRecord[];
  pagination: {
    page: number;
    perPage: number;
    pages: number;
    items: number;
  };
}

