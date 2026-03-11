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
  CheckSquare,
  Square,
  Loader,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
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

  const TRACKS_PER_PAGE = 50;

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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchUsers(), fetchTracks()]);
      setLoading(false);
    };
    loadData();
  }, [fetchStats, fetchUsers, fetchTracks]);

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

  const handleTrackSearch = () => {
    fetchTracks(1, trackSearch);
  };

  const totalPages = Math.ceil(tracksTotal / TRACKS_PER_PAGE);

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '10px 20px',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: tab === t ? '2px solid #F5E500' : '2px solid transparent',
    color: tab === t ? '#F5E500' : '#6B6B6B',
    transition: 'all 0.2s ease',
  });

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#6B6B6B' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 2rem 0' }}>
      <h1 style={{ color: '#FFFFFF', marginBottom: '0.5rem' }}>Admin Panel</h1>
      <p style={{ color: '#6B6B6B', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Manage tracks, users, and monitor your music library.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #363636', marginBottom: '1.5rem' }}>
        <button style={tabStyle('overview')} onClick={() => setTab('overview')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BarChart3 size={16} /> Overview
          </span>
        </button>
        <button style={tabStyle('tracks')} onClick={() => setTab('tracks')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Music size={16} /> Tracks ({stats?.total_tracks ?? 0})
          </span>
        </button>
        <button style={tabStyle('users')} onClick={() => setTab('users')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Users size={16} /> Users ({stats?.total_users ?? 0})
          </span>
        </button>
      </div>

      {/* ===== Overview ===== */}
      {tab === 'overview' && stats && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Total Tracks', value: stats.total_tracks, icon: <Music size={24} />, color: '#F5E500' },
              { label: 'Total Users', value: stats.total_users, icon: <Users size={24} />, color: '#1DB954' },
              { label: 'Total Plays', value: stats.total_plays, icon: <BarChart3 size={24} />, color: '#3B82F6' },
              { label: 'Storage Used', value: formatBytes(stats.storage_bytes), icon: <HardDrive size={24} />, color: '#F59E0B' },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: '#242424',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ color: card.color, opacity: 0.8 }}>{card.icon}</div>
                <div>
                  <div style={{ color: '#FFFFFF', fontSize: '1.5rem', fontWeight: 700 }}>{card.value}</div>
                  <div style={{ color: '#6B6B6B', fontSize: '0.85rem' }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Storage optimization */}
          <div style={{
            background: '#242424',
            borderRadius: '1rem',
            padding: '1.25rem 1.5rem',
            marginTop: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ color: '#FFFFFF', fontWeight: 500, fontSize: '0.95rem' }}>
                Compress All Tracks
              </div>
              <div style={{ color: '#6B6B6B', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Re-encodes tracks to 128kbps MP3 to save storage. Only compresses files that will get smaller.
              </div>
            </div>
            <button
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
              style={{
                padding: '0.6rem 1.25rem',
                background: '#F5E500',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#1A1A1A',
                cursor: compressing ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexShrink: 0,
                opacity: compressing ? 0.6 : 1,
              }}
            >
              {compressing ? (
                <><Loader size={16} className="spin" /> Compressing...</>
              ) : (
                <><HardDrive size={16} /> Compress</>
              )}
            </button>
            {compressMsg && (
              <div style={{ width: '100%', color: '#6B6B6B', fontSize: '0.85rem' }}>
                {compressMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Tracks Management ===== */}
      {tab === 'tracks' && (
        <div>
          {/* Search + Bulk actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search tracks..."
                value={trackSearch}
                onChange={(e) => setTrackSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTrackSearch()}
                style={{
                  flex: 1,
                  padding: '0.6rem 1rem',
                  background: '#2E2E2E',
                  border: '1px solid #363636',
                  borderRadius: '0.5rem',
                  color: '#FFFFFF',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleTrackSearch}
                style={{
                  padding: '0.6rem 1rem',
                  background: '#F5E500',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#1A1A1A',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Search size={16} /> Search
              </button>
            </div>

            {selectedTracks.size > 0 && (
              <button
                onClick={() => setConfirmDelete({ type: 'bulk' })}
                disabled={bulkDeleting}
                style={{
                  padding: '0.6rem 1rem',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  opacity: bulkDeleting ? 0.6 : 1,
                }}
              >
                {bulkDeleting ? <Loader size={16} className="spin" /> : <Trash2 size={16} />}
                Delete Selected ({selectedTracks.size})
              </button>
            )}
          </div>

          {/* Track table */}
          <div style={{ background: '#242424', borderRadius: '0.75rem', overflow: 'hidden' }}>
            {/* Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 50px 1fr 100px 100px 80px 70px 80px',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid #363636',
                color: '#6B6B6B',
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={toggleSelectAll}>
                {selectedTracks.size === tracks.length && tracks.length > 0 ? (
                  <CheckSquare size={16} style={{ color: '#F5E500' }} />
                ) : (
                  <Square size={16} />
                )}
              </div>
              <div></div>
              <div>Title / Artist</div>
              <div>Genre</div>
              <div>Uploaded By</div>
              <div>Plays</div>
              <div>Duration</div>
              <div></div>
            </div>

            {/* Rows */}
            {tracks.map((track) => (
              <div
                key={track.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 50px 1fr 100px 100px 80px 70px 80px',
                  padding: '0.6rem 1rem',
                  borderBottom: '1px solid #2E2E2E',
                  alignItems: 'center',
                  background: selectedTracks.has(track.id) ? 'rgba(245, 229, 0, 0.05)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <div
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={() => toggleTrackSelection(track.id)}
                >
                  {selectedTracks.has(track.id) ? (
                    <CheckSquare size={16} style={{ color: '#F5E500' }} />
                  ) : (
                    <Square size={16} style={{ color: '#6B6B6B' }} />
                  )}
                </div>
                <div>
                  {track.cover_art_url ? (
                    <img
                      src={track.cover_art_url}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: '0.25rem', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '0.25rem',
                        background: 'linear-gradient(135deg, #F5E500, #242424)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Music size={14} style={{ color: '#1A1A1A' }} />
                    </div>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  {editingTrack === track.id ? (
                    <>
                      <input
                        value={editValues.title}
                        onChange={(e) => setEditValues((v) => ({ ...v, title: e.target.value }))}
                        style={{ width: '100%', padding: '0.2rem 0.4rem', background: '#2E2E2E', border: '1px solid #F5E500', borderRadius: '0.25rem', color: '#FFFFFF', fontSize: '0.85rem', marginBottom: '0.2rem', outline: 'none' }}
                      />
                      <input
                        value={editValues.artist}
                        onChange={(e) => setEditValues((v) => ({ ...v, artist: e.target.value }))}
                        style={{ width: '100%', padding: '0.2rem 0.4rem', background: '#2E2E2E', border: '1px solid #363636', borderRadius: '0.25rem', color: '#6B6B6B', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </>
                  ) : (
                    <>
                      <div style={{ color: '#FFFFFF', fontWeight: 500, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {track.title}
                      </div>
                      <div style={{ color: '#6B6B6B', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {track.artist}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  {editingTrack === track.id ? (
                    <select
                      value={editValues.genre}
                      onChange={(e) => setEditValues((v) => ({ ...v, genre: e.target.value }))}
                      style={{ width: '100%', padding: '0.3rem', background: '#2E2E2E', border: '1px solid #F5E500', borderRadius: '0.25rem', color: '#FFFFFF', fontSize: '0.8rem', outline: 'none' }}
                    >
                      <option value="Unknown">Unknown</option>
                      <option value="Pop">Pop</option>
                      <option value="Rock">Rock</option>
                      <option value="Hip-Hop">Hip-Hop</option>
                      <option value="R&B">R&B</option>
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
                  ) : (
                    <span
                      style={{
                        color: track.genre === 'Unknown' ? '#6B6B6B' : '#F5E500',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                      onClick={(e) => { e.stopPropagation(); startEditing(track); }}
                      title="Click to edit"
                    >
                      {track.genre}
                    </span>
                  )}
                </div>
                <div style={{ color: '#6B6B6B', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.uploaded_by_username}
                </div>
                <div style={{ color: '#6B6B6B', fontSize: '0.85rem' }}>
                  {track.play_count}
                </div>
                <div style={{ color: '#6B6B6B', fontSize: '0.85rem' }}>
                  {formatDuration(track.duration)}
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {editingTrack === track.id ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        style={{ background: 'none', border: 'none', color: '#1DB954', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
                        title="Save"
                      >
                        <CheckSquare size={16} />
                      </button>
                      <button
                        onClick={() => setEditingTrack(null)}
                        style={{ background: 'none', border: 'none', color: '#6B6B6B', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
                        title="Cancel"
                      >
                        <Square size={16} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete({ type: 'track', id: track.id })}
                      disabled={deleting === track.id}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex',
                        opacity: deleting === track.id ? 0.4 : 0.7,
                        transition: 'opacity 0.2s',
                      }}
                      title="Delete track"
                    >
                      {deleting === track.id ? <Loader size={16} className="spin" /> : <Trash2 size={16} />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {tracks.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6B6B' }}>
                No tracks found.
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
              <button
                onClick={() => fetchTracks(tracksPage - 1, trackSearch)}
                disabled={tracksPage <= 1}
                style={{
                  background: 'none',
                  border: '1px solid #363636',
                  borderRadius: '0.5rem',
                  color: tracksPage <= 1 ? '#363636' : '#FFFFFF',
                  cursor: tracksPage <= 1 ? 'not-allowed' : 'pointer',
                  padding: '0.5rem',
                  display: 'flex',
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <span style={{ color: '#6B6B6B', fontSize: '0.9rem' }}>
                Page {tracksPage} of {totalPages}
              </span>
              <button
                onClick={() => fetchTracks(tracksPage + 1, trackSearch)}
                disabled={tracksPage >= totalPages}
                style={{
                  background: 'none',
                  border: '1px solid #363636',
                  borderRadius: '0.5rem',
                  color: tracksPage >= totalPages ? '#363636' : '#FFFFFF',
                  cursor: tracksPage >= totalPages ? 'not-allowed' : 'pointer',
                  padding: '0.5rem',
                  display: 'flex',
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== Users Management ===== */}
      {tab === 'users' && (
        <div style={{ background: '#242424', borderRadius: '0.75rem', overflow: 'hidden' }}>
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 200px 100px 100px 120px',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #363636',
              color: '#6B6B6B',
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <div>User</div>
            <div>Email</div>
            <div>Tracks</div>
            <div>Role</div>
            <div>Actions</div>
          </div>

          {users.map((u) => (
            <div
              key={u.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 200px 100px 100px 120px',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid #2E2E2E',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: '#FFFFFF', fontWeight: 500, fontSize: '0.9rem' }}>
                  {u.username}
                  {u.id === user?.id && (
                    <span style={{ color: '#F5E500', fontSize: '0.75rem', marginLeft: '0.5rem' }}>(you)</span>
                  )}
                </div>
                <div style={{ color: '#6B6B6B', fontSize: '0.8rem' }}>
                  Joined {formatDate(u.created_at)}
                </div>
              </div>
              <div style={{ color: '#6B6B6B', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.email}
              </div>
              <div style={{ color: '#6B6B6B', fontSize: '0.85rem' }}>
                {u.track_count}
              </div>
              <div>
                <span
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '1rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: u.is_admin ? 'rgba(245, 229, 0, 0.15)' : 'rgba(107, 107, 107, 0.15)',
                    color: u.is_admin ? '#F5E500' : '#6B6B6B',
                  }}
                >
                  {u.is_admin ? 'Admin' : 'User'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {u.id !== user?.id && (
                  <>
                    <button
                      onClick={() => handleToggleAdmin(u.id)}
                      style={{
                        background: 'none',
                        border: '1px solid #363636',
                        borderRadius: '0.375rem',
                        color: u.is_admin ? '#F5E500' : '#6B6B6B',
                        cursor: 'pointer',
                        padding: '0.3rem 0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.8rem',
                      }}
                      title={u.is_admin ? 'Remove admin' : 'Make admin'}
                    >
                      {u.is_admin ? <ShieldOff size={14} /> : <Shield size={14} />}
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ type: 'user', id: u.id })}
                      style={{
                        background: 'none',
                        border: '1px solid #363636',
                        borderRadius: '0.375rem',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '0.3rem 0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Delete user and all their tracks"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Confirm Delete Modal ===== */}
      {confirmDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{
              background: '#242424',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <AlertCircle size={24} style={{ color: '#ef4444' }} />
              <h3 style={{ color: '#FFFFFF', margin: 0 }}>Confirm Delete</h3>
            </div>
            <p style={{ color: '#6B6B6B', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {confirmDelete.type === 'bulk'
                ? `Are you sure you want to delete ${selectedTracks.size} selected tracks? This will remove the audio files permanently.`
                : confirmDelete.type === 'user'
                  ? 'Are you sure you want to delete this user? All their uploaded tracks will also be deleted permanently.'
                  : 'Are you sure you want to delete this track? The audio file will be removed permanently.'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: '#2E2E2E',
                  border: '1px solid #363636',
                  borderRadius: '0.5rem',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.type === 'bulk') handleBulkDelete();
                  else if (confirmDelete.type === 'track' && confirmDelete.id) handleDeleteTrack(confirmDelete.id);
                  else if (confirmDelete.type === 'user' && confirmDelete.id) handleDeleteUser(confirmDelete.id);
                }}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
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
