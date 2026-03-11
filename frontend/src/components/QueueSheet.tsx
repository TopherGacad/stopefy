import React, { useRef, useCallback, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { Track } from '../types';
import {
  Play,
  Pause,
  Shuffle,
  Timer,
  Music,
  GripVertical,
} from 'lucide-react';

const SWIPE_THRESHOLD = 80;
const ROW_HEIGHT = 64;

interface QueueSheetProps {
  open: boolean;
  onClose: () => void;
}

const QueueSheet: React.FC<QueueSheetProps> = ({ open, onClose }) => {
  const {
    currentTrack,
    isPlaying,
    queue,
    queueIndex,
    shuffle,
    togglePlayPause,
    toggleShuffle,
    reorderQueue,
    play,
  } = usePlayer();

  // Sheet dismiss state
  const [closing, setClosing] = useState(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetTouchStartY = useRef(0);
  const isSheetDragging = useRef(false);

  // Row drag reorder state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const dragStartY = useRef(0);
  const dragStartIdx = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      onClose();
      setClosing(false);
      setSheetDragY(0);
    }, 200);
  }, [onClose]);

  // Sheet swipe-to-dismiss (only from handle area)
  const handleSheetTouchStart = useCallback((e: React.TouchEvent) => {
    sheetTouchStartY.current = e.touches[0].clientY;
    isSheetDragging.current = true;
  }, []);

  const handleSheetTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSheetDragging.current) return;
    const delta = e.touches[0].clientY - sheetTouchStartY.current;
    setSheetDragY(Math.max(0, delta));
  }, []);

  const handleSheetTouchEnd = useCallback(() => {
    isSheetDragging.current = false;
    if (sheetDragY > SWIPE_THRESHOLD) {
      close();
    } else {
      setSheetDragY(0);
    }
  }, [sheetDragY, close]);

  // Row drag handlers (on grip icon)
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

    // Calculate which index we're hovering over
    const newHover = Math.max(
      0,
      Math.min(
        queue.length - queueIndex - 2,
        dragStartIdx.current + Math.round(deltaY / ROW_HEIGHT)
      )
    );
    setHoverIdx(newHover);
  }, [dragIdx, queue.length, queueIndex]);

  const handleGripTouchEnd = useCallback(() => {
    if (dragIdx === null || hoverIdx === null) return;

    const fromAbsolute = queueIndex + 1 + dragIdx;
    const toAbsolute = queueIndex + 1 + hoverIdx;

    if (fromAbsolute !== toAbsolute) {
      reorderQueue(fromAbsolute, toAbsolute);
    }

    setDragIdx(null);
    setDragOffsetY(0);
    setHoverIdx(null);
  }, [dragIdx, hoverIdx, queueIndex, reorderQueue]);

  if (!open) return null;

  const upNext: Track[] = queue.slice(queueIndex + 1);

  const getRowStyle = (localIdx: number): React.CSSProperties => {
    if (dragIdx === null) return {};

    // The dragged row
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

    // Other rows shift to make room
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

  return (
    <div
      className={`queue-sheet__overlay ${closing ? 'queue-sheet__overlay--closing' : ''}`}
      onClick={close}
    >
      <div
        className={`queue-sheet ${closing ? 'queue-sheet--closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={sheetDragY > 0 ? { transform: `translateY(${sheetDragY}px)`, transition: 'none' } : undefined}
      >
        {/* Drag handle — swipe dismiss only here */}
        <div
          className="queue-sheet__handle-area"
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
        >
          <div className="queue-sheet__handle" />
        </div>

        {/* Header */}
        <div className="queue-sheet__header">
          <h2 className="queue-sheet__title">Queue</h2>
        </div>

        {/* Scrollable content */}
        <div className="queue-sheet__scroll">
          {/* Now Playing */}
          {currentTrack && (
            <div className="queue-sheet__section">
              <div className="queue-sheet__now-playing">
                <div className="queue-sheet__np-art">
                  {currentTrack.cover_art_url ? (
                    <img src={currentTrack.cover_art_url} alt="" />
                  ) : (
                    <div className="queue-sheet__art-placeholder">
                      <Music size={18} />
                    </div>
                  )}
                </div>
                <div className="queue-sheet__eq">
                  <span className="queue-sheet__eq-bar" />
                  <span className="queue-sheet__eq-bar" />
                  <span className="queue-sheet__eq-bar" />
                </div>
                <div className="queue-sheet__np-text">
                  <span className="queue-sheet__np-name">{currentTrack.title}</span>
                  <span className="queue-sheet__np-artist">{currentTrack.artist}</span>
                </div>
                <button className="queue-sheet__pp-btn" onClick={togglePlayPause}>
                  {isPlaying ? <Pause size={18} fill="#000" stroke="#000" /> : <Play size={18} fill="#000" stroke="#000" />}
                </button>
              </div>
            </div>
          )}

          {/* Shuffle label */}
          {shuffle && (
            <div className="queue-sheet__shuffle-label">
              <Shuffle size={14} />
              <span>Shuffling from queue</span>
            </div>
          )}

          {/* Next Up */}
          {upNext.length > 0 && (
            <div className="queue-sheet__section">
              <span className="queue-sheet__section-label">Next up</span>
              <div
                className="queue-sheet__list"
                ref={listRef}
                onTouchMove={handleGripTouchMove}
                onTouchEnd={handleGripTouchEnd}
              >
                {upNext.map((track, i) => (
                  <div
                    key={`${track.id}-${i}`}
                    className={`queue-sheet__row ${dragIdx === i ? 'queue-sheet__row--dragging' : ''}`}
                    style={getRowStyle(i)}
                    onClick={() => dragIdx === null && play(track, queue)}
                  >
                    <div className="queue-sheet__row-art">
                      {track.cover_art_url ? (
                        <img src={track.cover_art_url} alt="" />
                      ) : (
                        <div className="queue-sheet__art-placeholder">
                          <Music size={16} />
                        </div>
                      )}
                    </div>
                    <div className="queue-sheet__row-text">
                      <span className="queue-sheet__row-name">{track.title}</span>
                      <span className="queue-sheet__row-artist">{track.artist}</span>
                    </div>
                    <div
                      className="queue-sheet__row-grip"
                      onTouchStart={(e) => handleGripTouchStart(e, i)}
                    >
                      <GripVertical size={18} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upNext.length === 0 && (
            <div className="queue-sheet__empty">
              No tracks up next
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="queue-sheet__bottom-bar">
          <button
            className={`queue-sheet__bottom-pill ${shuffle ? 'queue-sheet__bottom-pill--active' : ''}`}
            onClick={toggleShuffle}
          >
            <Shuffle size={16} />
            <span>Shuffle</span>
          </button>
          <button className="queue-sheet__bottom-pill">
            <Timer size={16} />
            <span>Timer</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QueueSheet;
