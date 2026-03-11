import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../api';
import { Track } from '../types';
import { Upload as UploadIcon, File, CheckCircle, AlertCircle, Music, X, Search, Download, Loader, Youtube, ImageIcon } from 'lucide-react';

interface UploadItem {
  id: string;
  file: globalThis.File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  track?: Track;
}

interface YouTubeResult {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
}

type TabType = 'upload' | 'youtube';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const Upload: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadHistory, setUploadHistory] = useState<Track[]>([]);

  // YouTube state
  const [ytQuery, setYtQuery] = useState('');
  const [ytDirectUrl, setYtDirectUrl] = useState('');
  const [ytResults, setYtResults] = useState<YouTubeResult[]>([]);
  const [ytSearching, setYtSearching] = useState(false);
  const [ytDownloading, setYtDownloading] = useState<Record<string, 'loading' | 'done' | 'error'>>({});
  const [ytDirectDownloading, setYtDirectDownloading] = useState(false);
  const [ytDirectStatus, setYtDirectStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [ytError, setYtError] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api.getTracks({ limit: 50 });
        const tracks = Array.isArray(data) ? data : data.tracks || [];
        setUploadHistory(tracks);
      } catch (err) {
        console.error('Failed to fetch upload history:', err);
      }
    };
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const uploadFile = useCallback(async (file: globalThis.File) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: UploadItem = {
      id,
      file,
      progress: 0,
      status: 'uploading',
    };

    setUploads((prev) => [...prev, item]);

    try {
      const track = await api.uploadTrack(file, (progress: number) => {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, progress: Math.round(progress) } : u
          )
        );
      });

      setUploads((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, status: 'done', progress: 100, track } : u
        )
      );

      setUploadHistory((prev) => [track, ...prev]);
    } catch (err: any) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === id
            ? { ...u, status: 'error', error: err?.message || 'Upload failed' }
            : u
        )
      );
    }
  }, []);

  const handleFiles = useCallback(
    (files: FileList | globalThis.File[]) => {
      const fileArr = Array.from(files);
      fileArr.forEach((file) => uploadFile(file));
    },
    [uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeUploadItem = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // YouTube handlers
  const handleYtSearch = async () => {
    if (!ytQuery.trim()) return;
    setYtSearching(true);
    setYtError('');
    setYtResults([]);
    try {
      const results = await api.youtubeSearch(ytQuery.trim());
      setYtResults(results);
    } catch (err: any) {
      setYtError(err?.message || 'Search failed');
    } finally {
      setYtSearching(false);
    }
  };

  const handleYtSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleYtSearch();
    }
  };

  const handleYtDownload = async (result: YouTubeResult) => {
    setYtDownloading((prev) => ({ ...prev, [result.id]: 'loading' }));
    try {
      const track = await api.youtubeDownload(result.url);
      setYtDownloading((prev) => ({ ...prev, [result.id]: 'done' }));
      setUploadHistory((prev) => [track, ...prev]);
    } catch (err: any) {
      setYtDownloading((prev) => ({ ...prev, [result.id]: 'error' }));
    }
  };

  const handleYtDirectDownload = async () => {
    if (!ytDirectUrl.trim()) return;
    setYtDirectDownloading(true);
    setYtDirectStatus('idle');
    setYtError('');
    try {
      const track = await api.youtubeDownload(ytDirectUrl.trim());
      setYtDirectDownloading(false);
      setYtDirectStatus('done');
      setUploadHistory((prev) => [track, ...prev]);
      setTimeout(() => setYtDirectStatus('idle'), 3000);
    } catch (err: any) {
      setYtDirectDownloading(false);
      setYtDirectStatus('error');
      setYtError(err?.message || 'Download failed');
    }
  };

  const handleYtDirectKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleYtDirectDownload();
    }
  };

  const handleBackfillCovers = async () => {
    setBackfilling(true);
    setBackfillMsg('');
    try {
      const result = await api.youtubeBackfillCovers();
      setBackfillMsg(result.message);
      // Refresh upload history to show new covers
      const data = await api.getTracks({ limit: 50 });
      const tracks = Array.isArray(data) ? data : data.tracks || [];
      setUploadHistory(tracks);
    } catch (err: any) {
      setBackfillMsg(err?.message || 'Failed to backfill covers');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="upload">
      <h1 className="upload__title">Upload Music</h1>

      {/* Tabs */}
      <div className="upload__tabs">
        <button
          className={`upload__tab ${activeTab === 'upload' ? 'upload__tab--active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <UploadIcon size={18} />
          Upload File
        </button>
        <button
          className={`upload__tab ${activeTab === 'youtube' ? 'upload__tab--active' : ''}`}
          onClick={() => setActiveTab('youtube')}
        >
          <Youtube size={18} />
          YouTube
        </button>
      </div>

      {/* ===== Upload File Tab ===== */}
      {activeTab === 'upload' && (
        <>
          {/* Drag and Drop Zone */}
          <div
            className={`upload__dropzone ${dragActive ? 'upload__dropzone--active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
          >
            <div className="upload__dropzone-icon">
              <UploadIcon size={48} />
            </div>
            <p className="upload__dropzone-text">Drop audio files here</p>
            <p className="upload__dropzone-or">or</p>
            <button
              className="upload__browse-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleBrowseClick();
              }}
            >
              Browse Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".mp3,.flac,.ogg,.wav,.m4a,.aac,.opus,.webm,.wma"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
            <p className="upload__dropzone-hint">
              Supported formats: MP3, FLAC, OGG, WAV, M4A, AAC, OPUS, WEBM
            </p>
          </div>

          {/* Upload Queue */}
          {uploads.length > 0 && (
            <div>
              <h2 className="upload__queue-title">Upload Queue</h2>
              <div className="upload__queue">
                {uploads.map((item) => (
                  <div key={item.id} className="upload__item">
                    <div className={`upload__item-icon upload__item-icon--${item.status === 'uploading' ? 'uploading' : item.status}`}>
                      {item.status === 'uploading' && <File size={24} />}
                      {item.status === 'done' && <CheckCircle size={24} />}
                      {item.status === 'error' && <AlertCircle size={24} />}
                    </div>
                    <div className="upload__item-info">
                      <div className="upload__item-name">{item.file.name}</div>

                      {item.status === 'uploading' && (
                        <div className="upload__item-progress">
                          <div
                            className="upload__item-progress-fill"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}

                      {item.status === 'uploading' && (
                        <div className="upload__item-pct">{item.progress}%</div>
                      )}

                      {item.status === 'done' && item.track && (
                        <div className="upload__item-success">
                          <span className="upload__item-success-label">Uploaded successfully</span>
                          {' - '}
                          {item.track.title && <span>{item.track.title}</span>}
                          {item.track.artist && <span> by {item.track.artist}</span>}
                          {item.track.album && <span> ({item.track.album})</span>}
                          {item.track.genre && (
                            <span className="upload__item-success-genre">{item.track.genre}</span>
                          )}
                        </div>
                      )}

                      {item.status === 'error' && (
                        <div className="upload__item-error">{item.error || 'Upload failed'}</div>
                      )}
                    </div>
                    <button className="upload__item-remove" onClick={() => removeUploadItem(item.id)}>
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== YouTube Tab ===== */}
      {activeTab === 'youtube' && (
        <div className="upload__yt-cards">
          {/* Direct URL Download */}
          <div className="upload__yt-card">
            <h3 className="upload__yt-card-title">Download from URL</h3>
            <div className="upload__yt-input-row">
              <input
                type="text"
                className="upload__yt-input"
                placeholder="Paste a YouTube URL..."
                value={ytDirectUrl}
                onChange={(e) => { setYtDirectUrl(e.target.value); setYtDirectStatus('idle'); }}
                onKeyDown={handleYtDirectKeyDown}
              />
              <button
                className={`upload__yt-btn ${ytDirectStatus === 'done' ? 'upload__yt-btn--done' : ''}`}
                onClick={handleYtDirectDownload}
                disabled={ytDirectDownloading || !ytDirectUrl.trim()}
              >
                {ytDirectDownloading ? (
                  <><Loader size={16} className="spin" /> Downloading...</>
                ) : ytDirectStatus === 'done' ? (
                  <><CheckCircle size={16} /> Done</>
                ) : (
                  <><Download size={16} /> Download</>
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="upload__yt-card">
            <h3 className="upload__yt-card-title">Search YouTube</h3>
            <div className="upload__yt-input-row">
              <input
                type="text"
                className="upload__yt-input"
                placeholder="Search for songs, artists..."
                value={ytQuery}
                onChange={(e) => setYtQuery(e.target.value)}
                onKeyDown={handleYtSearchKeyDown}
              />
              <button
                className="upload__yt-btn"
                onClick={handleYtSearch}
                disabled={ytSearching || !ytQuery.trim()}
              >
                {ytSearching ? (
                  <><Loader size={16} className="spin" /> Searching...</>
                ) : (
                  <><Search size={16} /> Search</>
                )}
              </button>
            </div>
          </div>

          {/* Backfill covers */}
          <div className="upload__backfill">
            <div className="upload__backfill-title">Fix Missing Cover Art</div>
            <div className="upload__backfill-desc">
              Searches YouTube for thumbnails of tracks without covers
            </div>
            <button
              className="upload__backfill-btn"
              onClick={handleBackfillCovers}
              disabled={backfilling}
            >
              {backfilling ? (
                <><Loader size={16} className="spin" /> Fetching...</>
              ) : (
                <><ImageIcon size={16} /> Fetch Covers</>
              )}
            </button>
            {backfillMsg && (
              <div className="upload__backfill-msg">{backfillMsg}</div>
            )}
          </div>

          {/* Error */}
          {ytError && (
            <div className="upload__yt-error">
              <AlertCircle size={16} />
              {ytError}
            </div>
          )}

          {/* Loading spinner for search */}
          {ytSearching && (
            <div className="upload__spinner">
              <div className="loading-spinner" />
            </div>
          )}

          {/* Search Results */}
          {ytResults.length > 0 && (
            <div>
              <h3 className="upload__yt-results-title">Search Results</h3>
              <div className="upload__yt-results">
                {ytResults.map((result) => {
                  const dlStatus = ytDownloading[result.id];
                  return (
                    <div key={result.id} className="upload__yt-result">
                      <div className="upload__yt-result-thumb">
                        {result.thumbnail ? (
                          <img src={result.thumbnail} alt={result.title} />
                        ) : (
                          <div className="upload__yt-result-thumb-empty">
                            <Music size={20} />
                          </div>
                        )}
                      </div>
                      <div className="upload__yt-result-info">
                        <div className="upload__yt-result-name">{result.title}</div>
                        <div className="upload__yt-result-meta">
                          <span className="upload__yt-result-channel">{result.channel}</span>
                          {result.duration > 0 && (
                            <span className="upload__yt-result-duration">{formatDuration(result.duration)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        className={`upload__yt-dl-btn ${dlStatus === 'done' ? 'upload__yt-dl-btn--done' : ''} ${dlStatus === 'error' ? 'upload__yt-dl-btn--error' : ''}`}
                        onClick={() => handleYtDownload(result)}
                        disabled={dlStatus === 'loading'}
                      >
                        {dlStatus === 'loading' ? (
                          <><Loader size={14} className="spin" /></>
                        ) : dlStatus === 'done' ? (
                          <><CheckCircle size={14} /></>
                        ) : dlStatus === 'error' ? (
                          <><AlertCircle size={14} /></>
                        ) : (
                          <><Download size={14} /></>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state after search */}
          {!ytSearching && ytResults.length === 0 && ytQuery && !ytError && (
            <div className="upload__yt-empty">
              <Youtube size={40} />
              <p>No results found. Try a different search.</p>
            </div>
          )}

          {/* Initial empty state */}
          {!ytSearching && ytResults.length === 0 && !ytQuery && !ytError && (
            <div className="upload__yt-empty">
              <Youtube size={40} />
              <p>Search YouTube or paste a URL to download music.</p>
            </div>
          )}
        </div>
      )}

      {/* Upload History (shown on both tabs) */}
      {uploadHistory.length > 0 && (
        <div>
          <h2 className="upload__history-title">Upload History</h2>
          <div className="upload__history">
            {uploadHistory.map((track) => (
              <div key={track.id} className="upload__history-row">
                <div className="upload__history-art">
                  {track.cover_art_url ? (
                    <img src={track.cover_art_url} alt="" />
                  ) : (
                    <div className="upload__history-art-placeholder">
                      <Music size={18} />
                    </div>
                  )}
                </div>
                <div className="upload__history-text">
                  <div className="upload__history-name">{track.title || 'Untitled'}</div>
                  <div className="upload__history-artist">{track.artist || 'Unknown Artist'}</div>
                </div>
                {track.uploaded_at && (
                  <div className="upload__history-date">{formatDate(track.uploaded_at)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
