import React, { useState, useEffect } from 'react';
import { Track } from '../types';
import { isTrackDownloaded, saveTrackOffline, removeOfflineTrack } from '../db';
import * as api from '../api';
import { Download, Check, Loader2, X } from 'lucide-react';

interface DownloadButtonProps {
  track: Track;
  size?: 'sm' | 'md';
}

type DownloadState = 'idle' | 'downloading' | 'downloaded' | 'error';

const DownloadButton: React.FC<DownloadButtonProps> = ({ track, size = 'sm' }) => {
  const [state, setState] = useState<DownloadState>('idle');

  useEffect(() => {
    const checkDownloaded = async () => {
      try {
        const downloaded = await isTrackDownloaded(track.id);
        setState(downloaded ? 'downloaded' : 'idle');
      } catch {
        setState('idle');
      }
    };
    checkDownloaded();
  }, [track.id]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (state === 'downloading') return;

    if (state === 'downloaded') {
      try {
        await removeOfflineTrack(track.id);
        setState('idle');
      } catch {
        setState('error');
      }
      return;
    }

    try {
      setState('downloading');
      const blob = await api.downloadTrackBlob(track.id);
      await saveTrackOffline(track.id, blob, track);
      setState('downloaded');
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  };

  const iconSize = size === 'sm' ? 16 : 20;

  return (
    <button
      className={`download-btn download-btn--${size} download-btn--${state}`}
      onClick={handleClick}
      title={state === 'downloaded' ? 'Remove from downloads' : 'Download for offline'}
    >
      {state === 'idle' && <Download size={iconSize} />}
      {state === 'downloading' && <Loader2 size={iconSize} className="spin" />}
      {state === 'downloaded' && <Check size={iconSize} />}
      {state === 'error' && <X size={iconSize} />}
    </button>
  );
};

export default DownloadButton;
