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
const FADE_INTERVAL_MS = 50;

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
  // Two audio elements that alternate roles
  const audioARef = useRef<HTMLAudioElement>(new Audio());
  const audioBRef = useRef<HTMLAudioElement>(new Audio());
  const activeAudioId = useRef<'A' | 'B'>('A');
  const objectUrlARef = useRef<string | null>(null);
  const objectUrlBRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  const getActiveAudio = () => activeAudioId.current === 'A' ? audioARef.current : audioBRef.current;
  const getInactiveAudio = () => activeAudioId.current === 'A' ? audioBRef.current : audioARef.current;
  const getActiveObjectUrlRef = () => activeAudioId.current === 'A' ? objectUrlARef : objectUrlBRef;
  const getInactiveObjectUrlRef = () => activeAudioId.current === 'A' ? objectUrlBRef : objectUrlARef;

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
  const xfadingRef = useRef(false);
  const xfadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { crossfadeDurationRef.current = crossfadeDuration; }, [crossfadeDuration]);

  // Set active audio volume on init and changes (only when not crossfading)
  useEffect(() => {
    if (!xfadingRef.current) {
      getActiveAudio().volume = volume;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  // ----- Shuffle helpers -----

  const buildShuffledOrder = useCallback((queueLength: number, currentIdx: number) => {
    const indices = Array.from({ length: queueLength }, (_, i) => i);
    const filtered = indices.filter((i) => i !== currentIdx);
    for (let i = filtered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }
    shuffledOrderRef.current = [currentIdx, ...filtered];
    shuffledPosRef.current = 0;
  }, []);

  useEffect(() => {
    if (shuffle && queue.length > 0) {
      buildShuffledOrder(queue.length, queueIndex);
    } else {
      shuffledOrderRef.current = [];
      shuffledPosRef.current = -1;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffle, queue.length]);

  // ----- Core helpers -----

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

  // Cancel any in-progress crossfade
  const cancelCrossfade = useCallback(() => {
    if (xfadeTimerRef.current) {
      clearInterval(xfadeTimerRef.current);
      xfadeTimerRef.current = null;
    }
    xfadingRef.current = false;
    // Stop the inactive audio (the one fading out)
    const inactive = getInactiveAudio();
    inactive.pause();
    inactive.removeAttribute('src');
    inactive.load();
    // Clean up its object URL
    const urlRef = getInactiveObjectUrlRef();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAudioSource = useCallback(async (audio: HTMLAudioElement, track: Track, urlRef: React.MutableRefObject<string | null>) => {
    // Clean up previous object URL for this audio
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }

    const offlineTrack = await getOfflineTrack(track.id);
    if (offlineTrack && offlineTrack.audioBlob) {
      const url = URL.createObjectURL(offlineTrack.audioBlob);
      urlRef.current = url;
      audio.src = url;
    } else if (navigator.onLine) {
      audio.src = getStreamUrl(track.id);
    } else {
      return false;
    }
    return true;
  }, []);

  const loadAndPlay = useCallback(async (track: Track) => {
    const audio = getActiveAudio();
    const urlRef = getActiveObjectUrlRef();
    const loaded = await loadAudioSource(audio, track, urlRef);
    if (!loaded) {
      console.warn('Track not available offline:', track.title);
      return false;
    }

    try {
      audio.volume = volumeRef.current;
      await audio.play();
      setIsPlaying(true);
      return true;
    } catch {
      setIsPlaying(false);
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAudioSource]);

  const playByIndex = useCallback(
    async (index: number) => {
      const q = queueRef.current;
      if (index < 0 || index >= q.length) return;

      const track = q[index];
      setQueueIndex(index);
      setCurrentTrack(track);

      const success = await loadAndPlay(track);

      if (!success && !navigator.onLine) {
        const nextIdx = getNextIndex();
        if (nextIdx !== -1 && nextIdx !== index) {
          playByIndex(nextIdx);
        }
      }
    },
    [loadAndPlay, getNextIndex]
  );

  // ----- Crossfade execution -----
  const startCrossfade = useCallback(async (nextIdx: number) => {
    const q = queueRef.current;
    if (nextIdx < 0 || nextIdx >= q.length) return;

    xfadingRef.current = true;
    const fadeDuration = crossfadeDurationRef.current;
    const vol = volumeRef.current;

    // Record play for the track that's ending
    const endingTrack = currentTrackRef.current;
    if (endingTrack) {
      recordPlay(endingTrack.id).catch(() => {});
    }

    // Load next track into the inactive audio
    const nextTrack = q[nextIdx];
    const inactiveAudio = getInactiveAudio();
    const inactiveUrlRef = getInactiveObjectUrlRef();
    const loaded = await loadAudioSource(inactiveAudio, nextTrack, inactiveUrlRef);

    if (!loaded) {
      xfadingRef.current = false;
      return;
    }

    // Start the next track at volume 0
    inactiveAudio.volume = 0;
    try {
      await inactiveAudio.play();
    } catch {
      xfadingRef.current = false;
      return;
    }

    // Update state to reflect the new track immediately
    setCurrentTrack(nextTrack);
    setQueueIndex(nextIdx);
    queueIndexRef.current = nextIdx;
    currentTrackRef.current = nextTrack;

    // Swap active audio so the new track is now "active"
    const fadingOutAudio = getActiveAudio(); // the old one, still playing
    activeAudioId.current = activeAudioId.current === 'A' ? 'B' : 'A';
    // Now getActiveAudio() returns inactiveAudio (the new track)
    // fadingOutAudio is the old track, fading out

    // Animate the volume crossfade
    const startTime = performance.now();
    const totalMs = fadeDuration * 1000;

    xfadeTimerRef.current = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / totalMs, 1);

      // Ease: sine curve for smooth feel
      const fadeOut = Math.cos(progress * Math.PI * 0.5); // 1 → 0
      const fadeIn = Math.sin(progress * Math.PI * 0.5);  // 0 → 1

      fadingOutAudio.volume = vol * fadeOut;
      getActiveAudio().volume = vol * fadeIn;

      if (progress >= 1) {
        // Crossfade complete
        if (xfadeTimerRef.current) {
          clearInterval(xfadeTimerRef.current);
          xfadeTimerRef.current = null;
        }
        fadingOutAudio.pause();
        fadingOutAudio.removeAttribute('src');
        fadingOutAudio.load();
        // Clean up old object URL
        const oldUrlRef = getInactiveObjectUrlRef(); // after swap, inactive = old
        if (oldUrlRef.current) {
          URL.revokeObjectURL(oldUrlRef.current);
          oldUrlRef.current = null;
        }
        getActiveAudio().volume = vol;
        xfadingRef.current = false;
      }
    }, FADE_INTERVAL_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAudioSource]);

  // ----- Audio event listeners (attached to BOTH audio elements) -----
  useEffect(() => {
    const audioA = audioARef.current;
    const audioB = audioBRef.current;

    const handleTimeUpdate = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      if (audio !== getActiveAudio()) return;

      setCurrentTime(audio.currentTime);

      // Check if we should start crossfading
      const xfadeSecs = crossfadeDurationRef.current;
      if (
        xfadeSecs > 0 &&
        !xfadingRef.current &&
        audio.duration > 0 &&
        audio.duration > xfadeSecs &&
        repeatRef.current !== 'one' &&
        audio.currentTime >= audio.duration - xfadeSecs
      ) {
        const nextIdx = getNextIndex();
        if (nextIdx !== -1) {
          startCrossfade(nextIdx);
        }
      }
    };

    const handleLoadedMetadata = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      if (audio !== getActiveAudio()) return;
      setDuration(audio.duration);
    };

    const handleEnded = (e: Event) => {
      const audio = e.target as HTMLAudioElement;
      if (audio !== getActiveAudio()) return;

      // If crossfading already handled the transition, ignore
      if (xfadingRef.current) return;

      setIsPlaying(false);

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

    audioA.addEventListener('timeupdate', handleTimeUpdate);
    audioA.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioA.addEventListener('ended', handleEnded);
    audioB.addEventListener('timeupdate', handleTimeUpdate);
    audioB.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioB.addEventListener('ended', handleEnded);

    return () => {
      audioA.removeEventListener('timeupdate', handleTimeUpdate);
      audioA.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioA.removeEventListener('ended', handleEnded);
      audioB.removeEventListener('timeupdate', handleTimeUpdate);
      audioB.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioB.removeEventListener('ended', handleEnded);
    };
  }, [getNextIndex, playByIndex, startCrossfade]);

  // ----- Flush pending plays when coming back online -----
  useEffect(() => {
    const handleOnline = () => {
      flushPendingPlays().catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    flushPendingPlays().catch(() => {});
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // ----- Public API -----

  const play = useCallback(
    async (track: Track, playlist?: Track[]) => {
      cancelCrossfade();

      if (playlist) {
        const trackIndex = playlist.findIndex((t) => t.id === track.id);
        setQueue(playlist);
        setQueueIndex(trackIndex >= 0 ? trackIndex : 0);
        queueRef.current = playlist;
        queueIndexRef.current = trackIndex >= 0 ? trackIndex : 0;
      } else {
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
    [loadAndPlay, cancelCrossfade]
  );

  const pause = useCallback(() => {
    getActiveAudio().pause();
    setIsPlaying(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resume = useCallback(() => {
    getActiveAudio().play()
      .then(() => setIsPlaying(true))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume]);

  const next = useCallback(() => {
    cancelCrossfade();
    const nextIdx = getNextIndex();
    if (nextIdx !== -1) {
      playByIndex(nextIdx);
    }
  }, [getNextIndex, playByIndex, cancelCrossfade]);

  const previous = useCallback(() => {
    cancelCrossfade();
    if (getActiveAudio().currentTime > 3) {
      getActiveAudio().currentTime = 0;
      return;
    }

    const prevIdx = getPrevIndex();
    if (prevIdx !== -1) {
      playByIndex(prevIdx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getPrevIndex, playByIndex, cancelCrossfade]);

  const seek = useCallback((time: number) => {
    const audio = getActiveAudio();
    audio.currentTime = time;
    setCurrentTime(time);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (!xfadingRef.current) {
      getActiveAudio().volume = clamped;
    }
    localStorage.setItem('stopefy-volume', String(clamped));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    cancelCrossfade();
    setQueue([]);
    setQueueIndex(-1);
    queueRef.current = [];
    queueIndexRef.current = -1;
  }, [cancelCrossfade]);

  // Restore audio source + seek position on first mount (paused)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const track = currentTrackRef.current;
    const savedTime = persisted?.currentTime ?? 0;
    if (!track) return;

    (async () => {
      const audio = getActiveAudio();
      const urlRef = getActiveObjectUrlRef();

      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }

      const offlineTrack = await getOfflineTrack(track.id);
      if (offlineTrack && offlineTrack.audioBlob) {
        const url = URL.createObjectURL(offlineTrack.audioBlob);
        urlRef.current = url;
        audio.src = url;
      } else if (navigator.onLine) {
        audio.src = getStreamUrl(track.id);
      } else {
        return;
      }

      const handleLoaded = () => {
        if (savedTime > 0 && savedTime < audio.duration) {
          audio.currentTime = savedTime;
          setCurrentTime(savedTime);
        }
        audio.removeEventListener('loadedmetadata', handleLoaded);
      };
      audio.addEventListener('loadedmetadata', handleLoaded);
      audio.load();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist player state to localStorage
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
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
      savePersistedState({
        currentTrack: currentTrackRef.current,
        queue: queueRef.current,
        queueIndex: queueIndexRef.current,
        currentTime: getActiveAudio().currentTime,
        shuffle: shuffleRef.current,
        repeat: repeatRef.current,
      });
      if (xfadeTimerRef.current) clearInterval(xfadeTimerRef.current);
      if (objectUrlARef.current) URL.revokeObjectURL(objectUrlARef.current);
      if (objectUrlBRef.current) URL.revokeObjectURL(objectUrlBRef.current);
      audioARef.current.pause();
      audioBRef.current.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
