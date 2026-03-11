import React, { useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../contexts/PlayerContext';
import DownloadButton from './DownloadButton';
import AddToPlaylist from './AddToPlaylist';
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
} from 'lucide-react';

const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const Player: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    repeat,
    togglePlayPause,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  const navigate = useNavigate();
  const progressRef = useRef<HTMLDivElement>(null);
  const [previousVolume, setPreviousVolume] = useState<number>(0.7);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !duration) return;
      const rect = progressRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const time = percentage * duration;
      seek(Math.max(0, Math.min(time, duration)));
    },
    [duration, seek]
  );

  const handleMuteToggle = useCallback(() => {
    if (volume > 0) {
      setPreviousVolume(volume);
      setVolume(0);
    } else {
      setVolume(previousVolume || 0.7);
    }
  }, [volume, previousVolume, setVolume]);

  return (
    <div className="player-bar">
      {/* Left: Track info */}
      <div className="player-bar__info" onClick={() => navigate('/now-playing')} style={{ cursor: 'pointer' }}>
        <div className="player-bar__art">
          {currentTrack?.cover_art_url ? (
            <img src={currentTrack.cover_art_url} alt="" />
          ) : (
            <div className="player-bar__art-placeholder">
              <Music />
            </div>
          )}
        </div>
        <div className="player-bar__text">
          <span className="player-bar__title">{currentTrack?.title}</span>
          <span className="player-bar__artist">{currentTrack?.artist}</span>
        </div>
      </div>

      {/* Center: Controls + Progress */}
      <div className="player-bar__controls">
        <div className="player-bar__buttons">
          <button
            className={`player-bar__btn ${shuffle ? 'player-bar__btn--active' : ''}`}
            onClick={toggleShuffle}
          >
            <Shuffle size={18} />
          </button>
          <button className="player-bar__btn" onClick={previous}>
            <SkipBack size={20} />
          </button>
          <button className="player-bar__btn player-bar__btn--play" onClick={togglePlayPause}>
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button className="player-bar__btn" onClick={next}>
            <SkipForward size={20} />
          </button>
          <button
            className={`player-bar__btn ${repeat !== 'none' ? 'player-bar__btn--active' : ''}`}
            onClick={cycleRepeat}
          >
            {repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>
        <div className="player-bar__progress">
          <span className="player-bar__time">{formatTime(currentTime)}</span>
          <div
            className="player-bar__progress-bar"
            onClick={handleProgressClick}
            ref={progressRef}
          >
            <div
              className="player-bar__progress-fill"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <span className="player-bar__time">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume + Download */}
      <div className="player-bar__right">
        <div className="player-bar__volume">
          <button className="player-bar__btn" onClick={handleMuteToggle}>
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
            className="player-bar__volume-slider"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />
        </div>
        {currentTrack && <AddToPlaylist track={currentTrack} size="sm" />}
        {currentTrack && <DownloadButton track={currentTrack} size="sm" />}
      </div>
    </div>
  );
};

export default Player;
