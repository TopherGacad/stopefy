import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import type { Track } from '../types';
import { getStreamUrl, recordPlay } from '../api';
import { getOfflineTrack } from '../db';

type RepeatMode = 'none' | 'one' | 'all';

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  queueIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  play: (track: Track, playlist?: Track[]) => void;
  pause: () => void;
  resume: () => void;
  togglePlayPause: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
}

const PlayerContext = createContext<PlayerContextType>(null!);
export const usePlayer = () => useContext(PlayerContext);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const objectUrlRef = useRef<string | null>(null);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('none');

  // Initialize volume from localStorage
  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem('stopefy-volume');
    return saved ? parseFloat(saved) : 0.7;
  });

  // ----- Refs that always hold the latest values (no stale closures) -----
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const shuffleRef = useRef(shuffle);
  const repeatRef = useRef(repeat);
  const currentTrackRef = useRef(currentTrack);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

  // Set audio volume on init and changes
  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  // ----- Core helpers (use refs to always read latest state) -----

  const getNextIndex = useCallback((): number => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    const shuf = shuffleRef.current;
    const rep = repeatRef.current;

    if (q.length === 0) return -1;

    if (shuf) {
      if (q.length === 1) return rep === 'none' ? -1 : 0;
      let next: number;
      do {
        next = Math.floor(Math.random() * q.length);
      } while (next === idx);
      return next;
    }

    const next = idx + 1;
    if (next < q.length) return next;
    if (rep === 'all') return 0;
    return -1;
  }, []);

  const getPrevIndex = useCallback((): number => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    const shuf = shuffleRef.current;
    const rep = repeatRef.current;

    if (q.length === 0) return -1;

    if (shuf) {
      let prev: number;
      do {
        prev = Math.floor(Math.random() * q.length);
      } while (prev === idx && q.length > 1);
      return prev;
    }

    const prev = idx - 1;
    if (prev >= 0) return prev;
    if (rep === 'all') return q.length - 1;
    return 0;
  }, []);

  const loadAndPlay = useCallback(async (track: Track) => {
    // Clean up previous object URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    // Check if track is available offline
    const offlineTrack = await getOfflineTrack(track.id);
    if (offlineTrack && offlineTrack.audioBlob) {
      const url = URL.createObjectURL(offlineTrack.audioBlob);
      objectUrlRef.current = url;
      audioRef.current.src = url;
    } else if (navigator.onLine) {
      audioRef.current.src = getStreamUrl(track.id);
    } else {
      console.warn('Track not available offline:', track.title);
      return false;
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
      return true;
    } catch {
      // Autoplay might be blocked
      setIsPlaying(false);
      return false;
    }
  }, []);

  const playByIndex = useCallback(
    async (index: number) => {
      const q = queueRef.current;
      if (index < 0 || index >= q.length) return;

      const track = q[index];
      setQueueIndex(index);
      setCurrentTrack(track);

      const success = await loadAndPlay(track);

      // If offline and track unavailable, try next
      if (!success && !navigator.onLine) {
        const nextIdx = getNextIndex();
        if (nextIdx !== -1 && nextIdx !== index) {
          playByIndex(nextIdx);
        }
      }
    },
    [loadAndPlay, getNextIndex]
  );

  // ----- Audio event listeners (attached once, use refs for latest state) -----
  useEffect(() => {
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);

      // Record the play
      const track = currentTrackRef.current;
      if (track) {
        recordPlay(track.id).catch(() => {});
      }

      const rep = repeatRef.current;

      if (rep === 'one') {
        // Repeat single track
        audio.currentTime = 0;
        audio.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      } else {
        // Auto-next (handles both 'none' and 'all')
        const nextIdx = getNextIndex();
        if (nextIdx !== -1) {
          playByIndex(nextIdx);
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [getNextIndex, playByIndex]);

  // ----- Public API -----

  const play = useCallback(
    async (track: Track, playlist?: Track[]) => {
      if (playlist) {
        const trackIndex = playlist.findIndex((t) => t.id === track.id);
        setQueue(playlist);
        setQueueIndex(trackIndex >= 0 ? trackIndex : 0);
        // Update refs immediately so handleEnded has the right data
        queueRef.current = playlist;
        queueIndexRef.current = trackIndex >= 0 ? trackIndex : 0;
      } else {
        // Check if track is in current queue
        const idx = queueRef.current.findIndex((t) => t.id === track.id);
        if (idx !== -1) {
          setQueueIndex(idx);
          queueIndexRef.current = idx;
        } else {
          setQueue([track]);
          setQueueIndex(0);
          queueRef.current = [track];
          queueIndexRef.current = 0;
        }
      }

      setCurrentTrack(track);
      currentTrackRef.current = track;
      await loadAndPlay(track);
    },
    [loadAndPlay]
  );

  const pause = useCallback(() => {
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(() => {});
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume]);

  const next = useCallback(() => {
    const nextIdx = getNextIndex();
    if (nextIdx !== -1) {
      playByIndex(nextIdx);
    }
  }, [getNextIndex, playByIndex]);

  const previous = useCallback(() => {
    // If more than 3 seconds in, restart the current track
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    const prevIdx = getPrevIndex();
    if (prevIdx !== -1) {
      playByIndex(prevIdx);
    }
  }, [getPrevIndex, playByIndex]);

  const seek = useCallback((time: number) => {
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    audioRef.current.volume = clamped;
    localStorage.setItem('stopefy-volume', String(clamped));
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => !s);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => {
      if (r === 'none') return 'one';
      if (r === 'one') return 'all';
      return 'none';
    });
  }, []);

  const addToQueue = useCallback((track: Track) => {
    setQueue((q) => {
      const newQ = [...q, track];
      queueRef.current = newQ;
      return newQ;
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((q) => {
      const newQueue = [...q];
      newQueue.splice(index, 1);
      queueRef.current = newQueue;
      return newQueue;
    });
    setQueueIndex((i) => {
      const newIdx = index < i ? i - 1 : i;
      queueIndexRef.current = newIdx;
      return newIdx;
    });
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((q) => {
      const newQueue = [...q];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);
      queueRef.current = newQueue;
      return newQueue;
    });
    setQueueIndex((currentIdx) => {
      let newIdx = currentIdx;
      if (currentIdx === fromIndex) {
        newIdx = toIndex;
      } else if (fromIndex < currentIdx && toIndex >= currentIdx) {
        newIdx = currentIdx - 1;
      } else if (fromIndex > currentIdx && toIndex <= currentIdx) {
        newIdx = currentIdx + 1;
      }
      queueIndexRef.current = newIdx;
      return newIdx;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueIndex(-1);
    queueRef.current = [];
    queueIndexRef.current = -1;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      audioRef.current.pause();
    };
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        queue,
        queueIndex,
        currentTime,
        duration,
        volume,
        shuffle,
        repeat,
        play,
        pause,
        resume,
        togglePlayPause,
        next,
        previous,
        seek,
        setVolume,
        toggleShuffle,
        cycleRepeat,
        addToQueue,
        removeFromQueue,
        reorderQueue,
        clearQueue,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
