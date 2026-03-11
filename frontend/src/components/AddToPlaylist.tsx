import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { Playlist, Track } from '../types';
import { ListPlus, Check, Loader, Plus, Music } from 'lucide-react';

interface AddToPlaylistProps {
  track: Track;
  size?: 'sm' | 'md';
}

const AddToPlaylist: React.FC<AddToPlaylistProps> = ({ track, size = 'sm' }) => {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (open) {
      setLoading(true);
      api
        .getPlaylists()
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setPlaylists(list);
          // Mark playlists that already contain this track
          const alreadyIn = new Set<number>();
          for (const p of list) {
            if (p.tracks?.some((t) => t.id === track.id)) {
              alreadyIn.add(p.id);
            }
          }
          setAdded(alreadyIn);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, track.id]);

  const handleAdd = async (playlistId: number) => {
    if (added.has(playlistId) || adding === playlistId) return;
    setAdding(playlistId);
    try {
      await api.addTrackToPlaylist(playlistId, track.id);
      setAdded((prev) => new Set(prev).add(playlistId));
    } catch {
      // May already be in playlist
    } finally {
      setAdding(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const playlist = await api.createPlaylist(newName.trim());
      await api.addTrackToPlaylist(playlist.id, track.id);
      setPlaylists((prev) => [playlist, ...prev]);
      setAdded((prev) => new Set(prev).add(playlist.id));
      setNewName('');
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const iconSize = size === 'sm' ? 16 : 20;

  return (
    <>
      <button
        className="btn btn--icon"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="Add to playlist"
      >
        <ListPlus size={iconSize} />
      </button>

      {open && (
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
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: '#242424',
              borderRadius: '1rem',
              padding: '1.5rem',
              width: '90%',
              maxWidth: '400px',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <h3 style={{ color: '#FFFFFF', margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>
              Add to Playlist
            </h3>
            <div
              style={{
                color: '#6B6B6B',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {track.title} — {track.artist}
            </div>

            {/* Create new playlist */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="New playlist name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                style={{
                  flex: 1,
                  padding: '0.6rem 0.75rem',
                  background: '#2E2E2E',
                  border: '1px solid #363636',
                  borderRadius: '0.5rem',
                  color: '#FFFFFF',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                style={{
                  padding: '0.6rem 0.75rem',
                  background: '#F5E500',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#1A1A1A',
                  cursor: creating || !newName.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  opacity: !newName.trim() ? 0.5 : 1,
                }}
              >
                {creating ? <Loader size={14} className="spin" /> : <Plus size={14} />}
                Create
              </button>
            </div>

            {/* Playlist list */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6B6B6B' }}>
                  <div className="loading-spinner" />
                </div>
              ) : playlists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6B6B6B', fontSize: '0.9rem' }}>
                  No playlists yet. Create one above.
                </div>
              ) : (
                playlists.map((pl) => {
                  const isAdded = added.has(pl.id);
                  const isAdding = adding === pl.id;
                  return (
                    <div
                      key={pl.id}
                      onClick={() => handleAdd(pl.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.7rem 0.75rem',
                        borderRadius: '0.5rem',
                        cursor: isAdded ? 'default' : 'pointer',
                        background: isAdded ? 'rgba(245, 229, 0, 0.05)' : 'transparent',
                        transition: 'background 0.15s ease',
                        marginBottom: '0.25rem',
                      }}
                      onMouseEnter={(e) => {
                        if (!isAdded) (e.currentTarget.style.background = '#2E2E2E');
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isAdded
                          ? 'rgba(245, 229, 0, 0.05)'
                          : 'transparent';
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '0.375rem',
                          background: 'linear-gradient(135deg, #F5E500, #2E2E2E)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Music size={16} style={{ color: '#1A1A1A' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: '#FFFFFF',
                            fontWeight: 500,
                            fontSize: '0.9rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {pl.name}
                        </div>
                        <div style={{ color: '#6B6B6B', fontSize: '0.8rem' }}>
                          {pl.track_count ?? 0} tracks
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {isAdding ? (
                          <Loader size={16} className="spin" style={{ color: '#F5E500' }} />
                        ) : isAdded ? (
                          <Check size={16} style={{ color: '#1DB954' }} />
                        ) : (
                          <Plus size={16} style={{ color: '#6B6B6B' }} />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              style={{
                marginTop: '1rem',
                padding: '0.6rem',
                background: '#2E2E2E',
                border: '1px solid #363636',
                borderRadius: '0.5rem',
                color: '#FFFFFF',
                cursor: 'pointer',
                fontSize: '0.9rem',
                width: '100%',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AddToPlaylist;
