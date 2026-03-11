import React, { useRef, useCallback, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePlayer } from '../contexts/PlayerContext';
import DownloadButton from '../components/DownloadButton';
import AddToPlaylist from '../components/AddToPlaylist';
import QueueSheet from '../components/QueueSheet';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  Music,
  ChevronDown,
  ListMusic,
} from 'lucide-react';

const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const NowPlaying: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    repeat,
    queue,
    queueIndex,
    togglePlayPause,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  const progressRef = useRef<HTMLDivElement>(null);
  const [previousVolume, setPreviousVolume] = useState<number>(0.7);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);

  const calcTimeFromX = useCallback(
    (clientX: number) => {
      if (!progressRef.current || !duration) return 0;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pct * duration;
    },
    [duration]
  );

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const time = calcTimeFromX(e.clientX);
      seek(time);
    },
    [calcTimeFromX, seek]
  );

  const handleProgressTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true);
      setDragTime(calcTimeFromX(e.touches[0].clientX));
    },
    [calcTimeFromX]
  );

  const handleProgressTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      setDragTime(calcTimeFromX(e.touches[0].clientX));
    },
    [isDragging, calcTimeFromX]
  );

  const handleProgressTouchEnd = useCallback(() => {
    if (isDragging) {
      seek(dragTime);
      setIsDragging(false);
    }
  }, [isDragging, dragTime, seek]);

  const handleMuteToggle = useCallback(() => {
    if (volume > 0) {
      setPreviousVolume(volume);
      setVolume(0);
    } else {
      setVolume(previousVolume || 0.7);
    }
  }, [volume, previousVolume, setVolume]);

  if (!currentTrack) {
    return <Navigate to="/" replace />;
  }

  const progress = duration ? ((isDragging ? dragTime : currentTime) / duration) * 100 : 0;

  return (
    <div className="now-playing">
      <div className="now-playing__header">
        <button className="now-playing__back" onClick={() => navigate(-1)}>
          <ChevronDown size={28} />
        </button>
        <div className="now-playing__header-text">
          <span className="now-playing__header-label">Now Playing</span>
          {queue.length > 1 && (
            <span className="now-playing__header-queue">
              <ListMusic size={13} />
              {queueIndex + 1} / {queue.length}
            </span>
          )}
        </div>
        <button className="now-playing__btn" onClick={() => setQueueOpen(true)}>
          <ListMusic size={22} />
        </button>
      </div>

      <div className="now-playing__art">
        {currentTrack.cover_art_url ? (
          <img src={currentTrack.cover_art_url} alt={currentTrack.title} />
        ) : (
          <div className="now-playing__art-placeholder">
            <Music size={80} />
          </div>
        )}
      </div>

      <div className="now-playing__info">
        <div className="now-playing__title">{currentTrack.title}</div>
        <div className="now-playing__artist">{currentTrack.artist}</div>
        {currentTrack.album && (
          <div className="now-playing__album">{currentTrack.album}</div>
        )}
      </div>

      <div className="now-playing__progress">
        <div
          className="now-playing__progress-bar"
          ref={progressRef}
          onClick={handleProgressClick}
          onTouchStart={handleProgressTouchStart}
          onTouchMove={handleProgressTouchMove}
          onTouchEnd={handleProgressTouchEnd}
        >
          <div
            className="now-playing__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="now-playing__times">
          <span>{formatTime(isDragging ? dragTime : currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="now-playing__controls">
        <button
          className={`now-playing__btn ${shuffle ? 'now-playing__btn--active' : ''}`}
          onClick={toggleShuffle}
        >
          <Shuffle size={20} />
        </button>
        <button className="now-playing__btn now-playing__btn--skip" onClick={previous}>
          <SkipBack size={28} fill="currentColor" />
        </button>
        <button className="now-playing__btn now-playing__btn--play" onClick={togglePlayPause}>
          {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
        </button>
        <button className="now-playing__btn now-playing__btn--skip" onClick={next}>
          <SkipForward size={28} fill="currentColor" />
        </button>
        <button
          className={`now-playing__btn ${repeat !== 'none' ? 'now-playing__btn--active' : ''}`}
          onClick={cycleRepeat}
        >
          {repeat === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
        </button>
      </div>

      <div className="now-playing__actions">
        <div className="now-playing__volume">
          <button className="now-playing__btn now-playing__btn--sm" onClick={handleMuteToggle}>
            {volume === 0 ? (
              <VolumeX size={18} />
            ) : volume < 0.5 ? (
              <Volume1 size={18} />
            ) : (
              <Volume2 size={18} />
            )}
          </button>
          <input
            type="range"
            className="now-playing__volume-slider"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />
        </div>
        <div className="now-playing__action-btns">
          <AddToPlaylist track={currentTrack} size="md" />
          <DownloadButton track={currentTrack} size="md" />
        </div>
      </div>

      {currentTrack.genre && (
        <div className="now-playing__meta">
          <span className="now-playing__meta-tag">{currentTrack.genre}</span>
          {currentTrack.year && (
            <span className="now-playing__meta-tag">{currentTrack.year}</span>
          )}
          {currentTrack.play_count > 0 && (
            <span className="now-playing__meta-tag">
              {currentTrack.play_count.toLocaleString()} plays
            </span>
          )}
        </div>
      )}

      <QueueSheet open={queueOpen} onClose={() => setQueueOpen(false)} />
    </div>
  );
};

export default NowPlaying;
