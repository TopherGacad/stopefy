import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../contexts/PlayerContext';
import * as api from '../api';
import { Playlist } from '../types';
import { getAllOfflineTracks, removeOfflineTrack, getOfflineStorageUsage } from '../db';
import type { DownloadedTrack } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Download, Music2, ListMusic, Trash2, HardDrive, Search } from 'lucide-react';

const FILTER_CHIPS = ['Playlists', 'Downloads'] as const;
type FilterChip = typeof FILTER_CHIPS[number];

const PlaylistThumb: React.FC<{ playlist: Playlist }> = ({ playlist }) => {
  const covers = (playlist.tracks || [])
    .map((t) => t.cover_art_url)
    .filter(Boolean)
    .slice(0, 4);

  if (covers.length <= 1) {
    return covers.length === 1 ? (
      <img src={covers[0]!} alt={playlist.name} />
    ) : (
      <div className="library__row-thumb-placeholder">
        <Music2 size={20} />
      </div>
    );
  }

  if (covers.length === 2) {
    return (
      <div className="library__thumb-grid library__thumb-grid--2">
        {covers.map((url, i) => (
          <img key={i} src={url!} alt="" />
        ))}
      </div>
    );
  }

  if (covers.length === 3) {
    return (
      <div className="library__thumb-grid library__thumb-grid--3">
        <img src={covers[0]!} alt="" className="library__thumb-grid--3-left" />
        <div className="library__thumb-grid--3-right">
          <img src={covers[1]!} alt="" />
          <img src={covers[2]!} alt="" />
        </div>
      </div>
    );
  }

  return (
    <div className="library__thumb-grid">
      {covers.map((url, i) => (
        <img key={i} src={url!} alt="" />
      ))}
    </div>
  );
};

const Library: React.FC = () => {
  const navigate = useNavigate();
  const player = usePlayer();
  const { user } = useAuth();

  const [activeChip, setActiveChip] = useState<FilterChip>('Playlists');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [downloadedTracks, setDownloadedTracks] = useState<DownloadedTrack[]>([]);
  const [storageUsage, setStorageUsage] = useState<{ count: number; sizeBytes: number }>({ count: 0, sizeBytes: 0 });
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    try {
      const data = await api.getPlaylists();
      setPlaylists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch playlists:', err);
    }
  }, []);

  const fetchDownloads = useCallback(async () => {
    try {
      const tracks = await getAllOfflineTracks();
      setDownloadedTracks(tracks || []);
      const usage = await getOfflineStorageUsage();
      setStorageUsage(usage);
    } catch (err) {
      console.error('Failed to fetch downloads:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchPlaylists(), fetchDownloads()]);
      setLoading(false);
    };
    init();
  }, [fetchPlaylists, fetchDownloads]);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setCreating(true);
    try {
      await api.createPlaylist(newPlaylistName.trim(), newPlaylistDescription.trim());
      setShowModal(false);
      setNewPlaylistName('');
      setNewPlaylistDescription('');
      await fetchPlaylists();
    } catch (err) {
      console.error('Failed to create playlist:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveDownload = async (trackId: number) => {
    try {
      await removeOfflineTrack(trackId);
      await fetchDownloads();
    } catch (err) {
      console.error('Failed to remove download:', err);
    }
  };

  const handlePlayDownloaded = (track: DownloadedTrack) => {
    const allMetadata = downloadedTracks.map((d: DownloadedTrack) => d.metadata);
    player.play(track.metadata, allMetadata);
  };

  const formatSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  return (
    <div className="library">
      {/* Header */}
      <div className="library__topbar">
        <div className="library__avatar">
          {user?.username?.charAt(0).toUpperCase() || 'U'}
        </div>
        <h1 className="library__title">Your Library</h1>
        <div className="library__topbar-actions">
          <button className="library__icon-btn" onClick={() => navigate('/search')}>
            <Search size={22} />
          </button>
          <button className="library__icon-btn" onClick={() => setShowModal(true)}>
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="library__chips">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip}
            className={`library__chip ${activeChip === chip ? 'library__chip--active' : ''}`}
            onClick={() => setActiveChip(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Sort row */}
      <div className="library__sort-row">
        <span className="library__sort-label">Recently added</span>
        <button
          className="library__icon-btn"
          onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
        >
          {viewMode === 'list' ? <ListMusic size={18} /> : <Music2 size={18} />}
        </button>
      </div>

      {loading ? (
        <div className="library__loading">Loading...</div>
      ) : (
        <>
          {activeChip === 'Playlists' && (
            <>
              {playlists.length === 0 ? (
                <div className="library__empty">
                  <ListMusic size={48} />
                  <p>No playlists yet</p>
                  <span>Create your first playlist to get started</span>
                </div>
              ) : viewMode === 'list' ? (
                <div className="library__list">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className="library__row"
                      onClick={() => navigate(`/playlist/${playlist.id}`)}
                    >
                      <div className="library__row-thumb">
                        <PlaylistThumb playlist={playlist} />
                      </div>
                      <div className="library__row-text">
                        <span className="library__row-title">{playlist.name}</span>
                        <span className="library__row-subtitle">
                          Playlist &bull; {user?.username || 'You'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="library__grid">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className="library__grid-card"
                      onClick={() => navigate(`/playlist/${playlist.id}`)}
                    >
                      <div className="library__grid-card-art">
                        <PlaylistThumb playlist={playlist} />
                      </div>
                      <span className="library__grid-card-title">{playlist.name}</span>
                      <span className="library__grid-card-sub">
                        Playlist &bull; {user?.username || 'You'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeChip === 'Downloads' && (
            <>
              {downloadedTracks.length > 0 && (
                <div className="library__storage-bar">
                  <HardDrive size={16} />
                  <span>{storageUsage.count} tracks &bull; {formatSize(storageUsage.sizeBytes)} MB</span>
                </div>
              )}

              {downloadedTracks.length === 0 ? (
                <div className="library__empty">
                  <Download size={48} />
                  <p>No downloaded tracks</p>
                  <span>Download tracks for offline listening</span>
                </div>
              ) : (
                <div className="library__list">
                  {downloadedTracks.map((track) => (
                    <div
                      key={track.trackId}
                      className="library__row"
                      onClick={() => handlePlayDownloaded(track)}
                    >
                      <div className="library__row-thumb">
                        {track.metadata?.cover_art_url ? (
                          <img src={track.metadata.cover_art_url} alt={track.metadata?.title} />
                        ) : (
                          <div className="library__row-thumb-placeholder">
                            <Music2 size={20} />
                          </div>
                        )}
                      </div>
                      <div className="library__row-text">
                        <span className="library__row-title">
                          {track.metadata?.title || 'Unknown Track'}
                        </span>
                        <span className="library__row-subtitle">
                          {track.metadata?.artist || 'Unknown Artist'}
                        </span>
                      </div>
                      <button
                        className="library__row-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveDownload(track.trackId);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Create Playlist Modal */}
      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal__overlay" />
          <div className="modal__content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Create Playlist</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label className="auth__label">Name</label>
              <input
                className="input"
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="My awesome playlist"
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="auth__label">Description</label>
              <input
                className="input"
                type="text"
                value={newPlaylistDescription}
                onChange={(e) => setNewPlaylistDescription(e.target.value)}
                placeholder="Add an optional description"
              />
            </div>
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleCreatePlaylist}
                disabled={creating || !newPlaylistName.trim()}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;
