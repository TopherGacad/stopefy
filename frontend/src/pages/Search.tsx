import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '../api';
import { Playlist, SearchResults } from '../types';
import TrackList from '../components/TrackList';
import { Search as SearchIcon, Camera, Music } from 'lucide-react';

const GENRES = [
  { name: 'Pop', gradient: 'linear-gradient(135deg, #F5E500, #FF6B6B)' },
  { name: 'Rock', gradient: 'linear-gradient(135deg, #E13333, #1A1A1A)' },
  { name: 'Hip-Hop', gradient: 'linear-gradient(135deg, #F5E500, #FF8C00)' },
  { name: 'Electronic', gradient: 'linear-gradient(135deg, #00CED1, #1A1A1A)' },
  { name: 'Jazz', gradient: 'linear-gradient(135deg, #DAA520, #1A1A1A)' },
  { name: 'Classical', gradient: 'linear-gradient(135deg, #6B6B6B, #242424)' },
  { name: 'R&B', gradient: 'linear-gradient(135deg, #8B008B, #1A1A1A)' },
  { name: 'Country', gradient: 'linear-gradient(135deg, #D2691E, #1A1A1A)' },
  { name: 'Metal', gradient: 'linear-gradient(135deg, #2E2E2E, #000000)' },
  { name: 'Indie', gradient: 'linear-gradient(135deg, #3CB371, #1A1A1A)' },
  { name: 'Latin', gradient: 'linear-gradient(135deg, #FF4500, #1A1A1A)' },
  { name: 'K-Pop', gradient: 'linear-gradient(135deg, #FF69B4, #1A1A1A)' },
];

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);
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

  const handleGenreClick = (genreName: string) => {
    setQuery(genreName);
    setSearchParams({ genre: genreName });
    performSearch(genreName);
  };

  const showGenreBrowse = !query && !hasSearched;
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

      {!loading && showGenreBrowse && (
        <>
          <h2 className="search__browse-label">Browse all</h2>
          <div className="search__genre-grid">
            {GENRES.map((genre) => (
              <div
                key={genre.name}
                className="search__genre-card"
                style={{ background: genre.gradient }}
                onClick={() => handleGenreClick(genre.name)}
              >
                <span className="search__genre-card-name">{genre.name}</span>
                <div className="search__genre-card-img">
                  <Music size={32} />
                </div>
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
