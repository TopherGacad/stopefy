import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '../api';
import { Playlist, SearchResults } from '../types';
import TrackList from '../components/TrackList';
import { Search as SearchIcon, Camera, Music, X, Clock, CloudSun, Flame, PartyPopper, Target, CloudRain, Car, Heart, Zap } from 'lucide-react';

const RECENT_SEARCHES_KEY = 'stopefy_recent_searches';
const MAX_RECENT = 8;

const MOODS = [
  { name: 'Chill', Icon: CloudSun, gradient: 'linear-gradient(135deg, #00B4DB, #0083B0)', keywords: 'chill lo-fi relaxing' },
  { name: 'Workout', Icon: Flame, gradient: 'linear-gradient(135deg, #F5E500, #FF6B6B)', keywords: 'workout energy pump' },
  { name: 'Party', Icon: PartyPopper, gradient: 'linear-gradient(135deg, #FF4500, #FF8C00)', keywords: 'party dance upbeat' },
  { name: 'Focus', Icon: Target, gradient: 'linear-gradient(135deg, #667eea, #764ba2)', keywords: 'focus study instrumental' },
  { name: 'Sad', Icon: CloudRain, gradient: 'linear-gradient(135deg, #4B6CB7, #182848)', keywords: 'sad emotional heartbreak' },
  { name: 'Drive', Icon: Car, gradient: 'linear-gradient(135deg, #E13333, #1A1A1A)', keywords: 'drive road trip cruising' },
  { name: 'Romance', Icon: Heart, gradient: 'linear-gradient(135deg, #8B008B, #FF69B4)', keywords: 'love romantic slow' },
  { name: 'Hype', Icon: Zap, gradient: 'linear-gradient(135deg, #F5E500, #1DB954)', keywords: 'hype rap hip-hop' },
];

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const recent = getRecentSearches().filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
  recent.unshift(trimmed);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function removeRecentSearch(query: string) {
  const recent = getRecentSearches().filter((s) => s !== query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

const ARTIST_COLORS = [
  '#F5E500', '#00CED1', '#E13333', '#1DB954', '#FF8C00',
  '#FF69B4', '#DAA520', '#8B008B', '#3CB371', '#FF4500',
];

function getArtistColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ARTIST_COLORS[Math.abs(hash) % ARTIST_COLORS.length];
}

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (searchQuery: string, save = true) => {
    if (!searchQuery.trim()) {
      setResults(null);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    if (save) {
      saveRecentSearch(searchQuery);
      setRecentSearches(getRecentSearches());
    }
    try {
      const data = await api.search(searchQuery);
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
      setResults({ tracks: [], artists: [], playlists: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle genre param on mount
  useEffect(() => {
    const genre = searchParams.get('genre');
    if (genre) {
      setQuery(genre);
      performSearch(genre);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleArtistClick = (artistName: string) => {
    setQuery(artistName);
    performSearch(artistName);
  };

  const handleMoodClick = (mood: typeof MOODS[0]) => {
    setQuery(mood.keywords);
    setSearchParams({ genre: mood.name });
    performSearch(mood.keywords);
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    performSearch(term, false);
  };

  const handleRemoveRecent = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    removeRecentSearch(term);
    setRecentSearches(getRecentSearches());
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const showBrowse = !query && !hasSearched;
  const showResults = hasSearched && results;
  const noResults =
    hasSearched &&
    results &&
    (!results.tracks || results.tracks.length === 0) &&
    (!results.artists || results.artists.length === 0) &&
    (!results.playlists || results.playlists.length === 0);

  return (
    <div className="search">
      <div className="search__header">
        <h1 className="search__title">Search</h1>
        <button className="search__camera-btn">
          <Camera size={22} />
        </button>
      </div>

      <div className="search-input-wrapper">
        <SearchIcon size={18} />
        <input
          type="text"
          className="search-input"
          placeholder="What do you want to listen to?"
          value={query}
          onChange={handleInputChange}
        />
      </div>

      {loading && (
        <div style={{ color: '#6B6B6B', textAlign: 'center', padding: '3rem' }}>
          Searching...
        </div>
      )}

      {!loading && showBrowse && (
        <>
          {recentSearches.length > 0 && (
            <div className="search__recent">
              <div className="search__recent-header">
                <h2 className="search__recent-label">Recent searches</h2>
                <button className="search__recent-clear" onClick={handleClearRecent}>
                  Clear all
                </button>
              </div>
              <div className="search__recent-chips">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    className="search__recent-chip"
                    onClick={() => handleRecentClick(term)}
                  >
                    <Clock size={14} />
                    <span>{term}</span>
                    <button
                      className="search__recent-chip-remove"
                      onClick={(e) => handleRemoveRecent(e, term)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="search__browse-label">Browse by mood</h2>
          <div className="search__mood-grid">
            {MOODS.map((mood) => (
              <div
                key={mood.name}
                className="search__mood-card"
                style={{ background: mood.gradient }}
                onClick={() => handleMoodClick(mood)}
              >
                <mood.Icon className="search__mood-icon" size={28} />
                <span className="search__mood-name">{mood.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && noResults && (
        <div className="search__empty" style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6B6B6B' }}>
          <Music size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p style={{ fontSize: '1.2rem' }}>No results found</p>
          <p style={{ fontSize: '0.9rem', color: '#6B6B6B' }}>
            Try searching for something else
          </p>
        </div>
      )}

      {!loading && showResults && !noResults && (
        <div className="search__results">
          {results.tracks && results.tracks.length > 0 && (
            <div className="section">
              <h2 className="section__title">Tracks</h2>
              <TrackList tracks={results.tracks} />
            </div>
          )}

          {results.artists && results.artists.length > 0 && (
            <div className="section">
              <h2 className="section__title">Artists</h2>
              <div className="artist-chips">
                {results.artists.map((artist: any, index: number) => {
                  const name = typeof artist === 'string' ? artist : artist.name;
                  const color = getArtistColor(name);
                  return (
                    <div
                      key={name + index}
                      className="artist-chip"
                      onClick={() => handleArtistClick(name)}
                    >
                      <div
                        className="artist-chip__avatar"
                        style={{
                          background: color,
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.4rem',
                          fontWeight: 700,
                          color: '#1A1A1A',
                        }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span className="artist-chip__name">{name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {results.playlists && results.playlists.length > 0 && (
            <div className="section">
              <h2 className="section__title">Playlists</h2>
              <div className="scroll-row">
                {results.playlists.map((playlist: Playlist) => (
                  <div
                    key={playlist.id}
                    className="playlist-card"
                    onClick={() => window.location.assign(`/playlist/${playlist.id}`)}
                  >
                    <div className="playlist-card__art">
                      {playlist.cover_image ? (
                        <img src={playlist.cover_image} alt={playlist.name} />
                      ) : (
                        <div
                          className="playlist-card__art-placeholder"
                          style={{
                            background: 'linear-gradient(135deg, #F5E500, #2E2E2E)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%',
                          }}
                        >
                          <span style={{ fontSize: '2rem' }}>&#9835;</span>
                        </div>
                      )}
                    </div>
                    <div className="playlist-card__name">{playlist.name}</div>
                    <div className="playlist-card__count">
                      {playlist.track_count ?? 0} tracks
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;
