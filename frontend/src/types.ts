export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  cover_art_url: string | null;
  uploaded_by: number;
  uploaded_at: string;
  play_count: number;
  year: number | null;
  file_size: number | null;
}

export interface Playlist {
  id: number;
  name: string;
  description: string;
  cover_image: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  tracks: Track[];
  track_count: number;
}

export interface PaginatedTracks {
  tracks: Track[];
  total: number;
  page: number;
  pages: number;
}

export interface SearchResults {
  tracks: Track[];
  artists: string[];
  playlists: Playlist[];
}

export interface WrappedData {
  year: number;
  total_minutes: number;
  top_tracks: { id: number; title: string; artist: string; album: string; cover_art_url: string | null; plays: number }[];
  top_artists: { name: string; plays: number; minutes: number }[];
  top_genres: { genre: string; plays: number }[];
  total_tracks_played: number;
  total_unique_tracks: number;
}

export interface DownloadedTrack {
  trackId: number;
  audioBlob: Blob;
  metadata: Track;
  downloadedAt: number;
}
