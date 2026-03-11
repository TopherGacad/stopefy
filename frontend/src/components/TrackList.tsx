import React, { useState, useCallback } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import DownloadButton from './DownloadButton';
import AddToPlaylist from './AddToPlaylist';
import { Plus, Clock, Minus, Check } from 'lucide-react';
import { Track } from '../types';

interface TrackListProps {
  tracks: Track[];
  showIndex?: boolean;
  showAlbum?: boolean;
  showArt?: boolean;
  onPlay?: (track: Track, index: number) => void;
  onRemove?: (trackId: number) => void;
  playlist?: Track[];
}

const formatDuration = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const TrackList: React.FC<TrackListProps> = ({
  tracks,
  showIndex = true,
  showAlbum = true,
  showArt = true,
  onPlay,
  onRemove,
  playlist,
}) => {
  const { currentTrack, isPlaying, play, addToQueue } = usePlayer();
  const [queuedIds, setQueuedIds] = useState<Set<number>>(new Set());

  const handlePlay = (track: Track, index: number) => {
    if (onPlay) {
      onPlay(track, index);
    } else {
      play(track, playlist || tracks);
    }
  };

  const handleAddToQueue = useCallback((track: Track) => {
    addToQueue(track);
    setQueuedIds((prev) => new Set(prev).add(track.id));
    setTimeout(() => {
      setQueuedIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }, 1500);
  }, [addToQueue]);

  return (
    <div className="track-list">
      <div className="track-list__header">
        {showIndex && (
          <span className="track-list__col track-list__col--index">#</span>
        )}
        <span className="track-list__col track-list__col--title">Title</span>
        {showAlbum && (
          <span className="track-list__col track-list__col--album">Album</span>
        )}
        <span className="track-list__col track-list__col--duration">
          <Clock size={14} />
        </span>
        <span className="track-list__col track-list__col--actions"></span>
      </div>
      {tracks.map((track, index) => (
        <div
          key={track.id}
          className={`track-list__row ${
            currentTrack?.id === track.id ? 'track-list__row--active' : ''
          }`}
          onClick={() => handlePlay(track, index)}
        >
          {showIndex && (
            <span className="track-list__col track-list__col--index">
              {currentTrack?.id === track.id && isPlaying ? (
                <span className="track-list__playing-icon">&#9654;</span>
              ) : (
                <span className="track-list__number">{index + 1}</span>
              )}
            </span>
          )}
          <span className="track-list__col track-list__col--title">
            <div className="track-list__title-group">
              {showArt && (
                <div className="track-list__art">
                  {track.cover_art_url ? (
                    <img src={track.cover_art_url} alt="" />
                  ) : (
                    <div className="track-list__art-placeholder" />
                  )}
                </div>
              )}
              <div>
                <div className="track-list__track-title">{track.title}</div>
                <div className="track-list__track-artist">{track.artist}</div>
              </div>
            </div>
          </span>
          {showAlbum && (
            <span className="track-list__col track-list__col--album">
              {track.album}
            </span>
          )}
          <span className="track-list__col track-list__col--duration">
            {formatDuration(track.duration)}
          </span>
          <span
            className="track-list__col track-list__col--actions"
            onClick={(e) => e.stopPropagation()}
          >
            <AddToPlaylist track={track} size="sm" />
            <button
              className="btn btn--icon"
              onClick={() => handleAddToQueue(track)}
              title="Add to queue"
              style={queuedIds.has(track.id) ? { color: '#1DB954' } : undefined}
            >
              {queuedIds.has(track.id) ? <Check size={16} /> : <Plus size={16} />}
            </button>
            <DownloadButton track={track} size="sm" />
            {onRemove && (
              <button
                className="btn btn--icon"
                onClick={() => onRemove(track.id)}
                title="Remove from playlist"
                style={{ color: '#ef4444' }}
              >
                <Minus size={16} />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

export default TrackList;
