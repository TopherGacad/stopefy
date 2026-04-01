import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import type { Track } from '../types';
import { getStreamUrl, recordPlay, flushPendingPlays } from '../api';
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
  crossfadeDuration: number;
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
  setCrossfadeDuration: (seconds: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
}

const PlayerContext = createContext<PlayerContextType>(null!);
export const usePlayer = () => useContext(PlayerContext);

const STORAGE_KEY = 'stopefy-player';
const CROSSFADE_KEY = 'stopefy-crossfade';

interface PersistedState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  currentTime: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — ignore
  }
}

function loadCrossfadeDuration(): number {
  try {
    const raw = localStorage.getItem(CROSSFADE_KEY);
    return raw ? parseFloat(raw) : 0;
  } catch {
    return 0;
  }
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const objectUrlRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  // Restore persisted state on first mount
  const persisted = useRef(loadPersistedState()).current;

  const [currentTrack, setCurrentTrack] = useState<Track | null>(persisted?.currentTrack ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Track[]>(persisted?.queue ?? []);
  const [queueIndex, setQueueIndex] = useState(persisted?.queueIndex ?? -1);
  const [currentTime, setCurrentTime] = useState(persisted?.currentTime ?? 0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(persisted?.shuffle ?? false);
  const [repeat, setRepeat] = useState<RepeatMode>(persisted?.repeat ?? 'none');
  const [crossfadeDuration, setCrossfadeDurationState] = useState(loadCrossfadeDuration);

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
  const volumeRef = useRef(volume);
  const crossfadeDurationRef = useRef(crossfadeDuration);

  // Shuffled order: an array of queue indices in shuffled order, and our position within it
  const shuffledOrderRef = useRef<number[]>([]);
  const shuffledPosRef = useRef(-1);

  // Crossfade state
  const fadeOutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFadingOutRef = useRef(false);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { crossfadeDurationRef.current = crossfadeDuration; }, [crossfadeDuration]);

  // Set audio volume on init and changes
  useEffect(() => {
    if (!isFadingOutRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // ----- Shuffle helpers -----

  const buildShuffledOrder = useCallback((queueLength: number, currentIdx: number) => {
    // Fisher-Yates shuffle of all indices, with currentIdx placed first
    const indices = Array.from({ length: queueLength }, (_, i) => i);
    const filtered = indices.filter((i) => i !== currentIdx);
    for (let i = filtered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }
    shuffledOrderRef.current = [currentIdx, ...filtered];
    shuffledPosRef.current = 0;
  }, []);

  // Regenerate shuffled order when queue changes or shuffle is toggled on
  useEffect(() => {
    if (shuffle && queue.length > 0) {
      buildShuffledOrder(queue.length, queueIndexRef.current);
    } else {
      shuffledOrderRef.current = [];
      shuffledPosRef.current = -1;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffle, queue]);

  // ----- Core helpers (use refs to always read latest state) -----

  const getNextIndex = useCallback((): number => {
    const q = queueRef.current;
    const shuf = shuffleRef.current;
    const rep = repeatRef.current;

    if (q.length === 0) return -1;

    if (shuf) {
      const order = shuffledOrderRef.current;
      const pos = shuffledPosRef.current;
      if (order.length === 0) return -1;

      const nextPos = pos + 1;
      if (nextPos < order.length) {
        shuffledPosRef.current = nextPos;
        return order[nextPos];
      }
      if (rep === 'all') {
        buildShuffledOrder(q.length, order[pos]);
        shuffledPosRef.current = 1;
        return shuffledOrderRef.current[1] ?? order[pos];
      }
      return -1;
    }

    const idx = queueIndexRef.current;
    const next = idx + 1;
    if (next < q.length) return next;
    if (rep === 'all') return 0;
    return -1;
  }, [buildShuffledOrder]);

  const getPrevIndex = useCallback((): number => {
    const q = queueRef.current;
    const shuf = shuffleRef.current;
    const rep = repeatRef.current;

    if (q.length === 0) return -1;

    if (shuf) {
      const order = shuffledOrderRef.current;
      const pos = shuffledPosRef.current;
      if (order.length === 0) return -1;

      const prevPos = pos - 1;
      if (prevPos >= 0) {
        shuffledPosRef.current = prevPos;
        return order[prevPos];
      }
      if (rep === 'all') {
        shuffledPosRef.current = order.length - 1;
        return order[order.length - 1];
      }
      return order[0];
    }

    const idx = queueIndexRef.current;
    const prev = idx - 1;
    if (prev >= 0) return prev;
    if (rep === 'all') return q.length - 1;
    return 0;
  }, []);

  // ----- Crossfade helpers -----

  const cancelFade = useCallback(() => {
    if (fadeOutTimerRef.current) {
      clearInterval(fadeOutTimerRef.current);
      fadeOutTimerRef.current = null;
    }
    isFadingOutRef.current = false;
    audioRef.current.volume = volumeRef.current;
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
      audioRef.current.volume = volumeRef.current;
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

      // Start fade-out when approaching end of track
      const xfadeSecs = crossfadeDurationRef.current;
      if (
        xfadeSecs > 0 &&
        !isFadingOutRef.current &&
        audio.duration > 0 &&
        audio.duration > xfadeSecs + 0.5 &&
        repeatRef.current !== 'one' &&
        audio.currentTime >= audio.duration - xfadeSecs
      ) {
        isFadingOutRef.current = true;
        const vol = volumeRef.current;
        const remainingSecs = audio.duration - audio.currentTime;
        const steps = Math.max(Math.floor(remainingSecs * 20), 1);
        let step = 0;
        fadeOutTimerRef.current = setInterval(() => {
          step++;
          const progress = Math.min(step / steps, 1);
          audio.volume = Math.max(vol * (1 - progress), 0);
          if (progress >= 1) {
            if (fadeOutTimerRef.current) {
              clearInterval(fadeOutTimerRef.current);
              fadeOutTimerRef.current = null;
            }
          }
        }, 50);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);

      // Clean up any fade state
      isFadingOutRef.current = false;
      if (fadeOutTimerRef.current) {
        clearInterval(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }

      // Always restore volume before playing next track
      audio.volume = volumeRef.current;

      // Record the play
      const track = currentTrackRef.current;
      if (track) {
        recordPlay(track.id).catch(() => {});
      }

      const rep = repeatRef.current;

      if (rep === 'one') {
        audio.currentTime = 0;
        audio.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      } else {
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

  // ----- Flush pending plays when coming back online -----
  useEffect(() => {
    const handleOnline = () => {
      flushPendingPlays().catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    // Also flush on mount in case we came back online before the app opened
    flushPendingPlays().catch(() => {});
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // ----- Public API -----

  const play = useCallback(
    async (track: Track, playlist?: Track[]) => {
      cancelFade();

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
    [loadAndPlay, cancelFade]
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
    cancelFade();
    const nextIdx = getNextIndex();
    if (nextIdx !== -1) {
      playByIndex(nextIdx);
    }
  }, [getNextIndex, playByIndex, cancelFade]);

  const previous = useCallback(() => {
    cancelFade();
    // If more than 3 seconds in, restart the current track
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    const prevIdx = getPrevIndex();
    if (prevIdx !== -1) {
      playByIndex(prevIdx);
    }
  }, [getPrevIndex, playByIndex, cancelFade]);

  const seek = useCallback((time: number) => {
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (!isFadingOutRef.current) {
      audioRef.current.volume = clamped;
    }
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

  const setCrossfadeDuration = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(12, seconds));
    setCrossfadeDurationState(clamped);
    localStorage.setItem(CROSSFADE_KEY, String(clamped));
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
    cancelFade();
    setQueue([]);
    setQueueIndex(-1);
    queueRef.current = [];
    queueIndexRef.current = -1;
  }, [cancelFade]);

  // Restore audio source + seek position on first mount (paused)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const track = currentTrackRef.current;
    const savedTime = persisted?.currentTime ?? 0;
    if (!track) return;

    (async () => {
      // Clean up any existing object URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const offlineTrack = await getOfflineTrack(track.id);
      if (offlineTrack && offlineTrack.audioBlob) {
        const url = URL.createObjectURL(offlineTrack.audioBlob);
        objectUrlRef.current = url;
        audioRef.current.src = url;
      } else if (navigator.onLine) {
        audioRef.current.src = getStreamUrl(track.id);
      } else {
        return;
      }

      // Seek to saved position once metadata is loaded
      const handleLoaded = () => {
        if (savedTime > 0 && savedTime < audioRef.current.duration) {
          audioRef.current.currentTime = savedTime;
          setCurrentTime(savedTime);
        }
        audioRef.current.removeEventListener('loadedmetadata', handleLoaded);
      };
      audioRef.current.addEventListener('loadedmetadata', handleLoaded);
      // Trigger load but don't play
      audioRef.current.load();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist player state to localStorage (throttled via timeupdate already)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Debounce saves to avoid hammering localStorage on every timeupdate
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      savePersistedState({
        currentTrack,
        queue,
        queueIndex,
        currentTime,
        shuffle,
        repeat,
      });
    }, 1000);
  }, [currentTrack, queue, queueIndex, currentTime, shuffle, repeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Save final state before unmount
      savePersistedState({
        currentTrack: currentTrackRef.current,
        queue: queueRef.current,
        queueIndex: queueIndexRef.current,
        currentTime: audioRef.current.currentTime,
        shuffle: shuffleRef.current,
        repeat: repeatRef.current,
      });
      if (fadeOutTimerRef.current) clearInterval(fadeOutTimerRef.current);
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
        crossfadeDuration,
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
        setCrossfadeDuration,
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
