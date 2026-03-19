import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import * as api from '../api';
import {
  Trash2,
  Shield,
  ShieldOff,
  Users,
  Music,
  HardDrive,
  BarChart3,
  Search,
  Loader,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

interface Stats {
  total_users: number;
  total_tracks: number;
  total_playlists: number;
  total_plays: number;
  storage_bytes: number;
}

interface AdminUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  track_count: number;
}

interface AdminTrack {
  id: number;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  cover_art_url: string | null;
  uploaded_by: number;
  uploaded_by_username: string;
  uploaded_at: string;
  play_count: number;
  file_size: number | null;
}

type Tab = 'overview' | 'tracks' | 'users';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

const Admin: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tracks, setTracks] = useState<AdminTrack[]>([]);
  const [tracksTotal, setTracksTotal] = useState(0);
  const [tracksPage, setTracksPage] = useState(1);
  const [trackSearch, setTrackSearch] = useState('');
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'track' | 'user' | 'bulk'; id?: number } | null>(null);
  const [editingTrack, setEditingTrack] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ title: string; artist: string; genre: string }>({ title: '', artist: '', genre: '' });
  const [compressing, setCompressing] = useState(false);
  const [compressMsg, setCompressMsg] = useState('');
  const [wrappedEnabled, setWrappedEnabled] = useState(false);

  const TRACKS_PER_PAGE = 20;

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.adminGetStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.adminGetUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  const fetchTracks = useCallback(async (page = 1, search = '') => {
    try {
      const data = await api.adminGetTracks({
        page,
        limit: TRACKS_PER_PAGE,
        search: search || undefined,
      });
      setTracks(data.tracks);
      setTracksTotal(data.total);
      setTracksPage(page);
      setSelectedTracks(new Set());
    } catch (err) {
      console.error('Failed to fetch tracks:', err);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.adminGetSettings();
      setWrappedEnabled(data.wrapped_enabled === 'true');
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, []);

  const handleToggleWrapped = async () => {
    const newValue = !wrappedEnabled;
    setWrappedEnabled(newValue);
    try {
      await api.adminUpdateSettings({ wrapped_enabled: String(newValue) });
    } catch {
      setWrappedEnabled(!newValue);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchUsers(), fetchTracks(), fetchSettings()]);
      setLoading(false);
    };
    loadData();
  }, [fetchStats, fetchUsers, fetchTracks, fetchSettings]);

  const handleDeleteTrack = async (trackId: number) => {
    setDeleting(trackId);
    try {
      await api.adminDeleteTrack(trackId);
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      setTracksTotal((prev) => prev - 1);
      setSelectedTracks((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
      fetchStats();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTracks.size === 0) return;
    setBulkDeleting(true);
    try {
      await api.adminBulkDeleteTracks(Array.from(selectedTracks));
      await fetchTracks(tracksPage, trackSearch);
      fetchStats();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBulkDeleting(false);
      setConfirmDelete(null);
    }
  };

  const handleToggleAdmin = async (userId: number) => {
    try {
      const result = await api.adminToggleAdmin(userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === result.id ? { ...u, is_admin: result.is_admin } : u))
      );
    } catch (err) {
      console.error('Toggle admin failed:', err);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await api.adminDeleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      fetchStats();
      fetchTracks(tracksPage, trackSearch);
    } catch (err) {
      console.error('Delete user failed:', err);
    } finally {
      setConfirmDelete(null);
    }
  };

  const startEditing = (track: AdminTrack) => {
    setEditingTrack(track.id);
    setEditValues({ title: track.title, artist: track.artist, genre: track.genre });
  };

  const handleSaveEdit = async () => {
    if (editingTrack === null) return;
    try {
      await api.updateTrack(editingTrack, editValues);
      setTracks((prev) =>
        prev.map((t) =>
          t.id === editingTrack
            ? { ...t, title: editValues.title, artist: editValues.artist, genre: editValues.genre }
            : t
        )
      );
    } catch (err) {
      console.error('Failed to update track:', err);
    } finally {
      setEditingTrack(null);
    }
  };

  const toggleTrackSelection = (id: number) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTracks.size === tracks.length) {
      setSelectedTracks(new Set());
    } else {
      setSelectedTracks(new Set(tracks.map((t) => t.id)));
    }
  };

  const handleTrackSearchSubmit = () => {
    fetchTracks(1, trackSearch);
  };

  const totalPages = Math.ceil(tracksTotal / TRACKS_PER_PAGE);

  // Pagination page numbers (max 5)
  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [];
    if (tracksPage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (tracksPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', tracksPage - 1, tracksPage, tracksPage + 1, '...', totalPages);
    }
    return pages;
  };

  const rangeStart = (tracksPage - 1) * TRACKS_PER_PAGE + 1;
  const rangeEnd = Math.min(tracksPage * TRACKS_PER_PAGE, tracksTotal);

  if (loading) {
    return (
      <div className="admin">
        <div className="admin__loading">
          <Loader size={24} className="spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="admin">
      {/* Header */}
      <div className="admin__header">
        <h1 className="admin__title">Admin Panel</h1>
        <p className="admin__subtitle">Manage tracks, users, and monitor your library.</p>
      </div>

      {/* Tab Row */}
      <div className="admin__tabs">
        <div className="admin__tabs-scroll">
          <button
            className={`admin__tab ${tab === 'overview' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            className={`admin__tab ${tab === 'tracks' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('tracks')}
          >
            Tracks ({stats?.total_tracks ?? 0})
          </button>
          <button
            className={`admin__tab ${tab === 'users' ? 'admin__tab--active' : ''}`}
            onClick={() => setTab('users')}
          >
            Users ({stats?.total_users ?? 0})
          </button>
        </div>
        <div className="admin__tabs-divider" />
      </div>

      {/* ===== Overview Tab ===== */}
      {tab === 'overview' && stats && (
        <div className="admin__section">
          <div className="admin__stats-grid">
            <div className="admin__stat-card">
              <Music size={20} className="admin__stat-icon admin__stat-icon--yellow" />
              <div className="admin__stat-number">{stats.total_tracks}</div>
              <div className="admin__stat-label">Total Tracks</div>
            </div>
            <div className="admin__stat-card">
              <Users size={20} className="admin__stat-icon admin__stat-icon--green" />
              <div className="admin__stat-number">{stats.total_users}</div>
              <div className="admin__stat-label">Total Users</div>
            </div>
            <div className="admin__stat-card">
              <BarChart3 size={20} className="admin__stat-icon admin__stat-icon--blue" />
              <div className="admin__stat-number">{stats.total_plays}</div>
              <div className="admin__stat-label">Total Plays</div>
            </div>
            <div className="admin__stat-card">
              <HardDrive size={20} className="admin__stat-icon admin__stat-icon--orange" />
              <div className="admin__stat-number">{formatBytes(stats.storage_bytes)}</div>
              <div className="admin__stat-label">Storage Used</div>
            </div>
          </div>

          <div className="admin__compress-card">
            <div className="admin__compress-title">Compress All Tracks</div>
            <div className="admin__compress-subtitle">
              Re-encodes tracks to 128kbps MP3 to save storage. Only compresses files that will get smaller.
            </div>
            <button
              className="admin__compress-btn"
              onClick={async () => {
                setCompressing(true);
                setCompressMsg('');
                try {
                  const result = await api.adminCompressAll();
                  setCompressMsg(result.message);
                  fetchStats();
                } catch (err: any) {
                  setCompressMsg(err?.message || 'Compression failed');
                } finally {
                  setCompressing(false);
                }
              }}
              disabled={compressing}
            >
              {compressing ? (
                <><Loader size={16} className="spin" /> Compressing...</>
              ) : (
                'Compress All'
              )}
            </button>
            {compressMsg && <div className="admin__compress-msg">{compressMsg}</div>}
          </div>

          <div className="admin__toggle-card">
            <div className="admin__toggle-info">
              <div className="admin__toggle-title">
                <Sparkles size={18} /> Wrapped {new Date().getFullYear()}
              </div>
              <div className="admin__toggle-subtitle">
                {wrappedEnabled
                  ? 'Users can view their yearly Wrapped stats'
                  : 'Wrapped is hidden from users'}
              </div>
            </div>
            <button
              className={`admin__toggle-switch ${wrappedEnabled ? 'admin__toggle-switch--on' : ''}`}
              onClick={handleToggleWrapped}
            >
              <div className="admin__toggle-knob" />
            </button>
          </div>
        </div>
      )}

      {/* ===== Tracks Tab ===== */}
      {tab === 'tracks' && (
        <div className="admin__section">
          {/* Search Bar */}
          <div className="admin__search-bar">
            <Search size={16} className="admin__search-icon" />
            <input
              type="text"
              className="admin__search-input"
              placeholder="Search tracks..."
              value={trackSearch}
              onChange={(e) => {
                setTrackSearch(e.target.value);
                if (e.target.value === '') fetchTracks(1, '');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleTrackSearchSubmit()}
            />
          </div>

          {/* Bulk Action Row */}
          <div className="admin__bulk-row">
            <div className="admin__bulk-left" onClick={toggleSelectAll}>
              {selectedTracks.size === tracks.length && tracks.length > 0 ? (
                <CheckSquare size={20} className="admin__check--active" />
              ) : (
                <Square size={20} className="admin__check" />
              )}
              <span className="admin__bulk-label">Select All</span>
            </div>
            {selectedTracks.size > 0 && (
              <button
                className="admin__bulk-delete"
                onClick={() => setConfirmDelete({ type: 'bulk' })}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                Delete ({selectedTracks.size})
              </button>
            )}
          </div>

          {/* Track List */}
          <div className="admin__track-list">
            {tracks.map((track) => (
              <div
                key={track.id}
                className={`admin__track-row ${selectedTracks.has(track.id) ? 'admin__track-row--selected' : ''}`}
              >
                <div
                  className="admin__track-check"
                  onClick={() => toggleTrackSelection(track.id)}
                >
                  {selectedTracks.has(track.id) ? (
                    <CheckSquare size={20} className="admin__check--active" />
                  ) : (
                    <Square size={20} className="admin__check" />
                  )}
                </div>

                <div className="admin__track-art" onClick={() => startEditing(track)}>
                  {track.cover_art_url ? (
                    <img src={track.cover_art_url} alt="" />
                  ) : (
                    <div className="admin__track-art-placeholder">
                      <Music size={16} />
                    </div>
                  )}
                </div>

                <div className="admin__track-info" onClick={() => startEditing(track)}>
                  {editingTrack === track.id ? (
                    <div className="admin__track-edit">
                      <input
                        className="admin__edit-input"
                        value={editValues.title}
                        onChange={(e) => setEditValues((v) => ({ ...v, title: e.target.value }))}
                        placeholder="Title"
                        autoFocus
                      />
                      <input
                        className="admin__edit-input admin__edit-input--secondary"
                        value={editValues.artist}
                        onChange={(e) => setEditValues((v) => ({ ...v, artist: e.target.value }))}
                        placeholder="Artist"
                      />
                      <select
                        className="admin__edit-select"
                        value={editValues.genre}
                        onChange={(e) => setEditValues((v) => ({ ...v, genre: e.target.value }))}
                      >
                        <option value="Unknown">Unknown</option>
                        <option value="Pop">Pop</option>
                        <option value="Rock">Rock</option>
                        <option value="Hip-Hop">Hip-Hop</option>
                        <option value="R&B">R&amp;B</option>
                        <option value="Electronic">Electronic</option>
                        <option value="Jazz">Jazz</option>
                        <option value="Classical">Classical</option>
                        <option value="Country">Country</option>
                        <option value="Metal">Metal</option>
                        <option value="Indie">Indie</option>
                        <option value="Latin">Latin</option>
                        <option value="K-Pop">K-Pop</option>
                        <option value="OPM">OPM</option>
                        <option value="Reggae">Reggae</option>
                        <option value="Blues">Blues</option>
                        <option value="Soul">Soul</option>
                        <option value="Folk">Folk</option>
                        <option value="Acoustic">Acoustic</option>
                        <option value="Alternative">Alternative</option>
                        <option value="Punk">Punk</option>
                        <option value="Dance">Dance</option>
                      </select>
                      <div className="admin__edit-actions">
                        <button className="admin__edit-save" onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}>Save</button>
                        <button className="admin__edit-cancel" onClick={(e) => { e.stopPropagation(); setEditingTrack(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="admin__track-title">{track.title}</div>
                      <div className="admin__track-artist">{track.artist}</div>
                      {track.genre && track.genre !== 'Unknown' && (
                        <span className="admin__track-genre">{track.genre}</span>
                      )}
                    </>
                  )}
                </div>

                <div className="admin__track-meta">
                  <span className="admin__track-plays">{track.play_count} plays</span>
                  <span className="admin__track-duration">{formatDuration(track.duration)}</span>
                  <button
                    className="admin__track-delete"
                    onClick={() => setConfirmDelete({ type: 'track', id: track.id })}
                    disabled={deleting === track.id}
                  >
                    {deleting === track.id ? <Loader size={18} className="spin" /> : <Trash2 size={18} />}
                  </button>
                </div>
              </div>
            ))}

            {tracks.length === 0 && (
              <div className="admin__empty">No tracks found.</div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="admin__pagination">
              <span className="admin__pagination-info">
                Showing {rangeStart}–{rangeEnd} of {tracksTotal}
              </span>
              <div className="admin__pagination-controls">
                <button
                  className="admin__page-btn"
                  onClick={() => fetchTracks(tracksPage - 1, trackSearch)}
                  disabled={tracksPage <= 1}
                >
                  <ChevronLeft size={16} />
                </button>
                {getPageNumbers().map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} className="admin__page-dots">...</span>
                  ) : (
                    <button
                      key={p}
                      className={`admin__page-num ${tracksPage === p ? 'admin__page-num--active' : ''}`}
                      onClick={() => fetchTracks(p as number, trackSearch)}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  className="admin__page-btn"
                  onClick={() => fetchTracks(tracksPage + 1, trackSearch)}
                  disabled={tracksPage >= totalPages}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Users Tab ===== */}
      {tab === 'users' && (
        <div className="admin__section">
          <div className="admin__user-list">
            {users.map((u) => (
              <div key={u.id} className="admin__user-card">
                <div className="admin__user-row1">
                  <div className="admin__user-name">
                    {u.username}
                    {u.id === user?.id && <span className="admin__user-you">(you)</span>}
                  </div>
                  <span className={`admin__user-badge ${u.is_admin ? 'admin__user-badge--admin' : ''}`}>
                    {u.is_admin ? 'Admin' : 'User'}
                  </span>
                </div>
                <div className="admin__user-email">{u.email}</div>
                <div className="admin__user-row3">
                  <span className="admin__user-date">Joined {formatDate(u.created_at)}</span>
                  <span className="admin__user-tracks">{u.track_count} tracks</span>
                  {u.id !== user?.id && (
                    <div className="admin__user-actions">
                      <button
                        className="admin__user-action-btn"
                        onClick={() => handleToggleAdmin(u.id)}
                        title={u.is_admin ? 'Remove admin' : 'Make admin'}
                      >
                        {u.is_admin ? <ShieldOff size={20} /> : <Shield size={20} />}
                      </button>
                      <button
                        className="admin__user-action-btn admin__user-action-btn--danger"
                        onClick={() => setConfirmDelete({ type: 'user', id: u.id })}
                        title="Delete user"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Confirm Delete Modal ===== */}
      {confirmDelete && (
        <div className="admin__modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="admin__modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin__modal-header">
              <AlertCircle size={24} className="admin__modal-icon" />
              <h3 className="admin__modal-title">Confirm Delete</h3>
            </div>
            <p className="admin__modal-text">
              {confirmDelete.type === 'bulk'
                ? `Are you sure you want to delete ${selectedTracks.size} selected tracks? This will remove the audio files permanently.`
                : confirmDelete.type === 'user'
                  ? 'Are you sure you want to delete this user? Their playlists and listening history will be removed, but their uploaded music will remain in the app.'
                  : 'Are you sure you want to delete this track? The audio file will be removed permanently.'}
            </p>
            <div className="admin__modal-actions">
              <button className="admin__modal-cancel" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                className="admin__modal-confirm"
                onClick={() => {
                  if (confirmDelete.type === 'bulk') handleBulkDelete();
                  else if (confirmDelete.type === 'track' && confirmDelete.id) handleDeleteTrack(confirmDelete.id);
                  else if (confirmDelete.type === 'user' && confirmDelete.id) handleDeleteUser(confirmDelete.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
