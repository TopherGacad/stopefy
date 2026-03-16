import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import * as api from '../api';
import { Playlist, Track } from '../types';
import { Play, Shuffle, Download, Trash2, Save, X, Music, ChevronLeft, Share2, MoreHorizontal, Globe, Plus, Pencil, Search, GripVertical, Check } from 'lucide-react';
import { saveTrackOffline, isTrackDownloaded } from '../db';
import ConfirmModal from '../components/ConfirmModal';

const ROW_HEIGHT = 64;

function formatTotalDuration(tracks: Track[]): string {
  const totalSeconds = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const PlaylistView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const player = usePlayer();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit name/description state
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Delete confirm modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Download all state
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  // Add songs state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<Track[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  // Edit (reorder) mode state
  const [editMode, setEditMode] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const dragStartY = useRef(0);
  const dragStartIdx = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const isOwner = playlist && user && playlist.created_by === user.id;

  const fetchPlaylist = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getPlaylist(Number(id));
      setPlaylist(data);
      setTracks(data.tracks || []);
      setEditName(data.name || '');
      setEditDescription(data.description || '');
    } catch (err: any) {
      setError(err?.message || 'Failed to load playlist');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPlaylist();
  }, [fetchPlaylist]);

  // Track which track IDs are already in the playlist (for Add sheet)
  useEffect(() => {
    setAddedIds(new Set(tracks.map((t) => t.id)));
  }, [tracks]);

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      player.play(tracks[0], tracks);
    }
  };

  const handleShuffle = () => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    player.play(shuffled[0], shuffled);
  };

  const handleDeletePlaylist = async () => {
    if (!id) return;
    try {
      await api.deletePlaylist(Number(id));
      navigate('/library');
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  };

  const handleSaveName = async () => {
    if (!id || !editName.trim()) return;
    try {
      await api.updatePlaylist(Number(id), { name: editName.trim() });
      setPlaylist((prev) => (prev ? { ...prev, name: editName.trim() } : prev));
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name:', err);
    }
  };

  const handleSaveDescription = async () => {
    if (!id) return;
    try {
      await api.updatePlaylist(Number(id), { description: editDescription.trim() });
      setPlaylist((prev) => (prev ? { ...prev, description: editDescription.trim() } : prev));
      setIsEditingDescription(false);
    } catch (err) {
      console.error('Failed to update description:', err);
    }
  };

  const handleDownloadAll = async () => {
    if (tracks.length === 0 || downloadingAll) return;
    setDownloadingAll(true);
    setDownloadProgress({ current: 0, total: tracks.length });

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      setDownloadProgress({ current: i + 1, total: tracks.length });

      try {
        const alreadyDownloaded = await isTrackDownloaded(track.id);
        if (alreadyDownloaded) continue;

        const blob = await api.downloadTrackBlob(track.id);
        await saveTrackOffline(track.id, blob, track);
      } catch (err) {
        console.error(`Failed to download track ${track.title}:`, err);
      }
    }

    setDownloadingAll(false);
  };

  const handleRemoveTrack = async (trackId: number) => {
    if (!id) return;
    try {
      await api.removeTrackFromPlaylist(Number(id), trackId);
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      setPlaylist((prev) =>
        prev ? { ...prev, track_count: (prev.track_count ?? 1) - 1 } : prev
      );
    } catch (err) {
      console.error('Failed to remove track:', err);
    }
  };

  // --- Add songs handlers ---
  const handleAddSearch = async () => {
    if (!addQuery.trim()) return;
    setAddSearching(true);
    try {
      const data = await api.getTracks({ search: addQuery.trim(), limit: 20 });
      const results = Array.isArray(data) ? data : data.tracks || [];
      setAddResults(results);
    } catch (err) {
      console.error('Add search failed:', err);
    } finally {
      setAddSearching(false);
    }
  };

  const handleAddTrack = async (track: Track) => {
    if (!id) return;
    try {
      await api.addTrackToPlaylist(Number(id), track.id);
      setTracks((prev) => [...prev, track]);
      setAddedIds((prev) => new Set(prev).add(track.id));
      setPlaylist((prev) =>
        prev ? { ...prev, track_count: (prev.track_count ?? 0) + 1 } : prev
      );
    } catch (err) {
      console.error('Failed to add track:', err);
    }
  };

  // Keep a ref to latest tracks so async callbacks never use stale data
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  // --- Drag reorder handlers ---
  const handleGripTouchStart = useCallback((e: React.TouchEvent, localIdx: number) => {
    e.stopPropagation();
    e.preventDefault();
    dragStartY.current = e.touches[0].clientY;
    dragStartIdx.current = localIdx;
    setDragIdx(localIdx);
    setHoverIdx(localIdx);
    setDragOffsetY(0);
  }, []);

  const handleGripTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragIdx === null) return;
    e.stopPropagation();
    const deltaY = e.touches[0].clientY - dragStartY.current;
    setDragOffsetY(deltaY);

    const newHover = Math.max(
      0,
      Math.min(
        tracksRef.current.length - 1,
        dragStartIdx.current + Math.round(deltaY / ROW_HEIGHT)
      )
    );
    setHoverIdx(newHover);
  }, [dragIdx]);

  const handleGripTouchEnd = useCallback(async () => {
    if (dragIdx === null || hoverIdx === null) return;

    const from = dragIdx;
    const to = hoverIdx;

    // Clear drag state immediately so the UI settles
    setDragIdx(null);
    setDragOffsetY(0);
    setHoverIdx(null);

    if (from !== to) {
      const oldTracks = tracksRef.current;
      const newTracks = [...oldTracks];
      const [moved] = newTracks.splice(from, 1);
      newTracks.splice(to, 0, moved);
      setTracks(newTracks);

      // Persist to backend
      if (id) {
        try {
          await api.reorderPlaylistTracks(Number(id), newTracks.map((t) => t.id));
        } catch (err) {
          console.error('Failed to reorder:', err);
          setTracks(oldTracks);
        }
      }
    }
  }, [dragIdx, hoverIdx, id]);

  const getRowStyle = (localIdx: number): React.CSSProperties => {
    if (dragIdx === null) return {};

    if (localIdx === dragIdx) {
      return {
        transform: `translateY(${dragOffsetY}px) scale(1.02)`,
        zIndex: 10,
        position: 'relative',
        background: '#2A2A2A',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        transition: 'box-shadow 0.15s ease, background 0.15s ease',
        borderRadius: '8px',
      };
    }

    if (hoverIdx !== null && dragIdx !== null) {
      if (dragIdx < hoverIdx && localIdx > dragIdx && localIdx <= hoverIdx) {
        return { transform: `translateY(-${ROW_HEIGHT}px)`, transition: 'transform 150ms ease' };
      }
      if (dragIdx > hoverIdx && localIdx < dragIdx && localIdx >= hoverIdx) {
        return { transform: `translateY(${ROW_HEIGHT}px)`, transition: 'transform 150ms ease' };
      }
    }

    return { transition: 'transform 150ms ease' };
  };

  if (loading) {
    return (
      <div className="playlist-view" style={{ color: '#6B6B6B', textAlign: 'center', padding: '4rem' }}>
        Loading...
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="playlist-view" style={{ color: '#ef4444', textAlign: 'center', padding: '4rem' }}>
        {error || 'Playlist not found'}
      </div>
    );
  }

  const coverImages = tracks
    .map((t) => t.cover_art_url)
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div className="pv">
      {/* Back button */}
      <button className="pv__back" onClick={() => navigate(-1)}>
        <ChevronLeft size={28} />
      </button>

      {/* 2x2 Thumbnail */}
      <div className="pv__thumb">
        {coverImages.length >= 2 ? (
          <div className="pv__thumb-grid">
            {[0, 1, 2, 3].map((i) =>
              coverImages[i] ? (
                <img key={i} src={coverImages[i]!} alt="" />
              ) : (
                <div key={i} className="pv__thumb-grid-empty" />
              )
            )}
          </div>
        ) : coverImages.length === 1 ? (
          <img src={coverImages[0]!} alt={playlist.name} />
        ) : (
          <div className="pv__thumb-placeholder">
            <Music size={64} />
          </div>
        )}
      </div>

      {/* Playlist Info */}
      <div className="pv__info">
        {isEditingName ? (
          <div className="pv__edit-row">
            <input
              className="pv__name-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <button onClick={handleSaveName} className="pv__edit-btn pv__edit-btn--save">
              <Save size={18} />
            </button>
            <button
              onClick={() => { setIsEditingName(false); setEditName(playlist.name); }}
              className="pv__edit-btn pv__edit-btn--cancel"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <h1
            className="pv__name"
            onClick={() => isOwner && setIsEditingName(true)}
          >
            {playlist.name}
          </h1>
        )}

        {isEditingDescription ? (
          <div className="pv__edit-row">
            <input
              className="pv__name-input pv__name-input--desc"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              autoFocus
            />
            <button onClick={handleSaveDescription} className="pv__edit-btn pv__edit-btn--save">
              <Save size={16} />
            </button>
            <button
              onClick={() => { setIsEditingDescription(false); setEditDescription(playlist.description || ''); }}
              className="pv__edit-btn pv__edit-btn--cancel"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          playlist.description && (
            <p className="pv__desc" onClick={() => isOwner && setIsEditingDescription(true)}>
              {playlist.description}
            </p>
          )
        )}

        <div className="pv__owner-row">
          <div className="pv__owner-avatar">
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span className="pv__owner-name">{user?.username || 'You'}</span>
        </div>

        <div className="pv__meta-row">
          <Globe size={12} />
          <span>{tracks.length} tracks</span>
          {tracks.length > 0 && (
            <>
              <span>&bull;</span>
              <span>{formatTotalDuration(tracks)}</span>
            </>
          )}
        </div>
      </div>

      {/* Top action row: Download, Share, Shuffle + Play */}
      <div className="pv__action-bar">
        <div className="pv__action-left">
          <button
            className="pv__action-icon"
            onClick={handleDownloadAll}
            disabled={tracks.length === 0 || downloadingAll}
          >
            <Download size={22} />
          </button>
          <button className="pv__action-icon">
            <Share2 size={22} />
          </button>
          <button
            className="pv__action-icon"
            onClick={handleShuffle}
            disabled={tracks.length === 0}
          >
            <Shuffle size={22} />
          </button>
          {isOwner && (
            <button className="pv__action-icon pv__action-icon--danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={22} />
            </button>
          )}
        </div>
        <div className="pv__action-right">
          <button
            className="pv__play-btn"
            onClick={handlePlayAll}
            disabled={tracks.length === 0}
          >
            <Play size={24} fill="#fff" stroke="#fff" />
          </button>
        </div>
      </div>

      {/* Bottom action row: Add + Edit (owner only) */}
      {isOwner && (
        <div className="pv__secondary-bar">
          <button
            className="pv__pill-btn"
            onClick={() => { setShowAddSheet(true); setAddQuery(''); setAddResults([]); }}
          >
            <Plus size={18} />
            <span>Add</span>
          </button>
          <button
            className={`pv__pill-btn ${editMode ? 'pv__pill-btn--active' : ''}`}
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? <Check size={18} /> : <Pencil size={18} />}
            <span>{editMode ? 'Done' : 'Edit'}</span>
          </button>
        </div>
      )}

      {/* Download progress */}
      {downloadingAll && (
        <div className="pv__dl-progress">
          Downloading {downloadProgress.current}/{downloadProgress.total}...
        </div>
      )}

      {/* Track List */}
      <div className="pv__tracks">
        {tracks.length > 0 ? (
          <div
            className="pv__track-list"
            ref={listRef}
            onTouchMove={editMode ? handleGripTouchMove : undefined}
            onTouchEnd={editMode ? handleGripTouchEnd : undefined}
          >
            {tracks.map((track, i) => (
              <div
                key={track.id}
                className={`pv__track-row ${player.currentTrack?.id === track.id ? 'pv__track-row--active' : ''}`}
                style={editMode ? getRowStyle(i) : undefined}
                onClick={() => !editMode && player.play(track, tracks)}
              >
                <div className="pv__track-art">
                  {track.cover_art_url ? (
                    <img src={track.cover_art_url} alt="" />
                  ) : (
                    <div className="pv__track-art-placeholder">
                      <Music size={18} />
                    </div>
                  )}
                </div>
                <div className="pv__track-text">
                  <span className="pv__track-name">{track.title}</span>
                  <span className="pv__track-artist">{track.artist}</span>
                </div>
                {editMode ? (
                  <div
                    className="pv__track-grip"
                    onTouchStart={(e) => handleGripTouchStart(e, i)}
                  >
                    <GripVertical size={18} />
                  </div>
                ) : isOwner ? (
                  <button
                    className="pv__track-menu"
                    onClick={(e) => { e.stopPropagation(); handleRemoveTrack(track.id); }}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <button className="pv__track-menu" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="pv__empty">
            <Music size={48} />
            <p>This playlist is empty</p>
            <span>Add tracks using the playlist icon on any song</span>
          </div>
        )}
      </div>

      {/* Add Songs Sheet */}
      {showAddSheet && (
        <div className="pv__add-overlay" onClick={() => setShowAddSheet(false)}>
          <div className="pv__add-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pv__add-handle" />
            <h2 className="pv__add-title">Add Songs</h2>
            <div className="pv__add-search-row">
              <input
                className="pv__add-input"
                placeholder="Search for songs..."
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSearch()}
                autoFocus
              />
              <button className="pv__add-search-btn" onClick={handleAddSearch} disabled={addSearching || !addQuery.trim()}>
                <Search size={18} />
              </button>
            </div>
            <div className="pv__add-results">
              {addSearching && (
                <div className="pv__add-loading">Searching...</div>
              )}
              {!addSearching && addResults.length === 0 && addQuery && (
                <div className="pv__add-loading">No results found</div>
              )}
              {addResults.map((track) => {
                const alreadyIn = addedIds.has(track.id);
                return (
                  <div key={track.id} className="pv__add-row">
                    <div className="pv__track-art">
                      {track.cover_art_url ? (
                        <img src={track.cover_art_url} alt="" />
                      ) : (
                        <div className="pv__track-art-placeholder">
                          <Music size={18} />
                        </div>
                      )}
                    </div>
                    <div className="pv__track-text">
                      <span className="pv__track-name">{track.title}</span>
                      <span className="pv__track-artist">{track.artist}</span>
                    </div>
                    <button
                      className={`pv__add-track-btn ${alreadyIn ? 'pv__add-track-btn--added' : ''}`}
                      onClick={() => !alreadyIn && handleAddTrack(track)}
                      disabled={alreadyIn}
                    >
                      {alreadyIn ? <Check size={16} /> : <Plus size={16} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete Playlist"
        message="Are you sure you want to delete this playlist? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDeletePlaylist();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

export default PlaylistView;
