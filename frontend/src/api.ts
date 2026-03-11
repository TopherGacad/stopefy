import type { User, Track, PaginatedTracks, Playlist, SearchResults, WrappedData } from './types';

const API_BASE = '/api';

class AuthError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthError';
  }
}

function getTokens() {
  return {
    access_token: localStorage.getItem('access_token'),
    refresh_token: localStorage.getItem('refresh_token'),
  };
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const { access_token } = getTokens();

  const headers = new Headers(options.headers);
  if (access_token) {
    headers.set('Authorization', `Bearer ${access_token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (e) {
    // Network error (offline) — don't clear tokens
    throw new Error('Network error — you may be offline');
  }

  if (response.status === 401) {
    // Attempt token refresh
    const { refresh_token } = getTokens();
    if (refresh_token) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setTokens(data.access_token, data.refresh_token);

          // Retry original request with new token
          headers.set('Authorization', `Bearer ${data.access_token}`);
          response = await fetch(url, { ...options, headers });
        } else {
          clearTokens();
          throw new AuthError();
        }
      } catch (e) {
        if (e instanceof AuthError) throw e;
        // Network error during refresh — don't clear tokens (offline)
        throw new Error('Network error — you may be offline');
      }
    } else {
      clearTokens();
      throw new AuthError();
    }
  }

  if (!response.ok) {
    const text = await response.text();
    let message: string;
    try {
      const json = JSON.parse(text);
      message = json.detail || json.message || text;
    } catch {
      message = text;
    }
    throw new Error(message);
  }

  return response;
}

export async function register(
  username: string,
  email: string,
  password: string
): Promise<{ user: User; access_token: string; refresh_token: string }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    let message: string;
    try {
      const json = JSON.parse(text);
      message = json.detail || json.message || text;
    } catch {
      message = text;
    }
    throw new Error(message);
  }

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function login(
  username: string,
  password: string
): Promise<{ user: User; access_token: string; refresh_token: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    let message: string;
    try {
      const json = JSON.parse(text);
      message = json.detail || json.message || text;
    } catch {
      message = text;
    }
    throw new Error(message);
  }

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function refreshToken(): Promise<{ access_token: string; refresh_token: string }> {
  const { refresh_token } = getTokens();
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  });

  if (!res.ok) {
    clearTokens();
    throw new AuthError();
  }

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export function logout(): void {
  clearTokens();
}

export async function getMe(): Promise<User> {
  const res = await fetchWithAuth(`${API_BASE}/auth/me`);
  return res.json();
}

export async function getTracks(params?: {
  page?: number;
  limit?: number;
  genre?: string;
  artist?: string;
  search?: string;
}): Promise<PaginatedTracks> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.genre) searchParams.set('genre', params.genre);
  if (params?.artist) searchParams.set('artist', params.artist);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  const url = `${API_BASE}/tracks${query ? `?${query}` : ''}`;
  const res = await fetchWithAuth(url);
  return res.json();
}

export async function getTrack(id: number): Promise<Track> {
  const res = await fetchWithAuth(`${API_BASE}/tracks/${id}`);
  return res.json();
}

export function getStreamUrl(id: number): string {
  return `${API_BASE}/tracks/${id}/stream`;
}

export async function downloadTrackBlob(id: number): Promise<Blob> {
  const res = await fetchWithAuth(`${API_BASE}/tracks/${id}/download`);
  return res.blob();
}

export function uploadTrack(file: File, onProgress?: (pct: number) => void): Promise<Track> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', `${API_BASE}/tracks/upload`);

    const token = localStorage.getItem('access_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(formData);
  });
}

export async function deleteTrack(id: number): Promise<void> {
  await fetchWithAuth(`${API_BASE}/tracks/${id}`, { method: 'DELETE' });
}

export async function updateTrack(
  id: number,
  data: { title?: string; artist?: string; album?: string; genre?: string }
): Promise<Track> {
  const res = await fetchWithAuth(`${API_BASE}/tracks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function recordPlay(id: number): Promise<void> {
  await fetchWithAuth(`${API_BASE}/tracks/${id}/play`, { method: 'POST' });
}

export async function getPlaylists(): Promise<Playlist[]> {
  const res = await fetchWithAuth(`${API_BASE}/playlists`);
  return res.json();
}

export async function getPlaylist(id: number): Promise<Playlist> {
  const res = await fetchWithAuth(`${API_BASE}/playlists/${id}`);
  return res.json();
}

export async function createPlaylist(name: string, description?: string): Promise<Playlist> {
  const res = await fetchWithAuth(`${API_BASE}/playlists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: description || '' }),
  });
  return res.json();
}

export async function updatePlaylist(
  id: number,
  data: { name?: string; description?: string }
): Promise<Playlist> {
  const res = await fetchWithAuth(`${API_BASE}/playlists/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deletePlaylist(id: number): Promise<void> {
  await fetchWithAuth(`${API_BASE}/playlists/${id}`, { method: 'DELETE' });
}

export async function addTrackToPlaylist(playlistId: number, trackId: number): Promise<Playlist> {
  const res = await fetchWithAuth(`${API_BASE}/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_id: trackId }),
  });
  return res.json();
}

export async function removeTrackFromPlaylist(playlistId: number, trackId: number): Promise<Playlist> {
  const res = await fetchWithAuth(`${API_BASE}/playlists/${playlistId}/tracks/${trackId}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function search(query: string): Promise<SearchResults> {
  const res = await fetchWithAuth(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function getWrapped(year: number): Promise<WrappedData> {
  const res = await fetchWithAuth(`${API_BASE}/wrapped/${year}`);
  return res.json();
}

export async function youtubeSearch(query: string): Promise<any[]> {
  const res = await fetchWithAuth(`${API_BASE}/youtube/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

export async function youtubeDownload(url: string): Promise<Track> {
  const res = await fetchWithAuth(`${API_BASE}/youtube/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export async function youtubeBackfillCovers(): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${API_BASE}/youtube/backfill-covers`, {
    method: 'POST',
  });
  return res.json();
}

// --- Admin API ---

export async function adminGetStats(): Promise<{
  total_users: number;
  total_tracks: number;
  total_playlists: number;
  total_plays: number;
  storage_bytes: number;
}> {
  const res = await fetchWithAuth(`${API_BASE}/admin/stats`);
  return res.json();
}

export async function adminGetUsers(): Promise<any[]> {
  const res = await fetchWithAuth(`${API_BASE}/admin/users`);
  return res.json();
}

export async function adminGetTracks(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ tracks: any[]; total: number; page: number }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  const res = await fetchWithAuth(`${API_BASE}/admin/tracks${query ? `?${query}` : ''}`);
  return res.json();
}

export async function adminDeleteTrack(id: number): Promise<void> {
  await fetchWithAuth(`${API_BASE}/admin/tracks/${id}`, { method: 'DELETE' });
}

export async function adminBulkDeleteTracks(trackIds: number[]): Promise<{ deleted: number }> {
  const res = await fetchWithAuth(`${API_BASE}/admin/tracks/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_ids: trackIds }),
  });
  return res.json();
}

export async function adminToggleAdmin(userId: number): Promise<{ id: number; username: string; is_admin: boolean }> {
  const res = await fetchWithAuth(`${API_BASE}/admin/users/${userId}/toggle-admin`, {
    method: 'PATCH',
  });
  return res.json();
}

export async function adminDeleteUser(userId: number): Promise<void> {
  await fetchWithAuth(`${API_BASE}/admin/users/${userId}`, { method: 'DELETE' });
}

export async function adminCompressAll(): Promise<{ compressed: number; total: number; saved_mb: number; message: string }> {
  const res = await fetchWithAuth(`${API_BASE}/admin/compress-all`, { method: 'POST' });
  return res.json();
}
