import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import * as api from '../api';
import { Track, Playlist } from '../types';
import { Play, Settings } from 'lucide-react';

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const player = usePlayer();

  const [popularTracks, setPopularTracks] = useState<Track[]>([]);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [popularRes, recentRes, playlistRes] = await Promise.all([
          api.getTracks({ limit: 10 }),
          api.getTracks({ limit: 10, page: 1 }),
          api.getPlaylists(),
        ]);
        setPopularTracks(Array.isArray(popularRes) ? popularRes : popularRes.tracks || []);
        setRecentTracks(Array.isArray(recentRes) ? recentRes : recentRes.tracks || []);
        setPlaylists(Array.isArray(playlistRes) ? playlistRes : []);
      } catch (err) {
        console.error('Failed to fetch home data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handlePlayTrack = (track: Track, playlist: Track[]) => {
    player.play(track, playlist);
  };

  const renderTrackCard = (track: Track, _index: number, list: Track[]) => (
    <div
      key={track.id}
      className="track-card"
      onClick={() => handlePlayTrack(track, list)}
    >
      <div className="track-card__art">
        {track.cover_art_url ? (
          <img src={track.cover_art_url} alt={track.title} />
        ) : (
          <div
            className="track-card__art-placeholder"
            style={{
              background: 'linear-gradient(135deg, #F5E500, #242424)',
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
        <div className="track-card__play-btn">
          <Play size={24} fill="#FFFFFF" stroke="#FFFFFF" />
        </div>
      </div>
      <div className="track-card__info">
        <div className="track-card__title" title={track.title}>
          {track.title}
        </div>
        <div className="track-card__artist">{track.artist}</div>
      </div>
    </div>
  );

  const renderPlaylistCard = (playlist: Playlist) => (
    <div
      key={playlist.id}
      className="playlist-card"
      onClick={() => navigate(`/playlist/${playlist.id}`)}
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
  );

  return (
    <div className="home">
      <div className="home__header">
        <h1 className="home__greeting">
          {getGreeting()}, {user?.username || 'Guest'}
        </h1>
        <button
          className="home__settings-btn"
          onClick={() => navigate('/settings')}
          title="Settings"
        >
          <Settings size={22} />
        </button>
      </div>

      {loading ? (
        <div className="home__loading" style={{ color: '#6B6B6B', textAlign: 'center', padding: '3rem' }}>
          Loading...
        </div>
      ) : (
        <>
          {popularTracks.length > 0 && (
            <div className="section section--featured">
              <h2 className="section__title">Popular Tracks</h2>
              <div className="scroll-row">
                {popularTracks.map(renderTrackCard)}
              </div>
            </div>
          )}

          {recentTracks.length > 0 && (
            <div className="section">
              <h2 className="section__title">Recently Added</h2>
              <div className="scroll-row">
                {recentTracks.map(renderTrackCard)}
              </div>
            </div>
          )}

          {playlists.length > 0 && (
            <div className="section">
              <h2 className="section__title">Your Playlists</h2>
              <div className="scroll-row">
                {playlists.map(renderPlaylistCard)}
              </div>
            </div>
          )}

          <div className="section">
            <h2 className="section__title">Browse Genres</h2>
            <div className="search__genres">
              {GENRES.map((genre) => (
                <div
                  key={genre.name}
                  className="genre-card"
                  style={{ background: genre.gradient }}
                  onClick={() => navigate(`/search?genre=${encodeURIComponent(genre.name)}`)}
                >
                  <span className="genre-card__name">{genre.name}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;
