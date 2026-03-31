import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import * as api from '../api';
import { Track, Playlist } from '../types';
import { Play, Settings, Sparkles, ChevronRight } from 'lucide-react';

const GENRES = [
  { name: 'Pop', gradient: 'linear-gradient(135deg, #F5E500, #FF6B6B)' },
  { name: 'Rock', gradient: 'linear-gradient(135deg, #E13333, #1A1A1A)' },
  { name: 'Hip-Hop', gradient: 'linear-gradient(135deg, #F5E500, #FF8C00)' },
  { name: 'Rap', gradient: 'linear-gradient(135deg, #FF6347, #1A1A1A)' },
  { name: 'R&B', gradient: 'linear-gradient(135deg, #8B008B, #1A1A1A)' },
  { name: 'OPM', gradient: 'linear-gradient(135deg, #0038A8, #CE1126)' },
  { name: 'Electronic', gradient: 'linear-gradient(135deg, #00CED1, #1A1A1A)' },
  { name: 'Jazz', gradient: 'linear-gradient(135deg, #DAA520, #1A1A1A)' },
  { name: 'Classical', gradient: 'linear-gradient(135deg, #6B6B6B, #242424)' },
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
  const { user, isAdmin } = useAuth();
  const player = usePlayer();

  const [popularTracks, setPopularTracks] = useState<Track[]>([]);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [suggested, setSuggested] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [wrappedEnabled, setWrappedEnabled] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [popularRes, recentRes, suggestedRes, playlistRes, wrappedRes] = await Promise.allSettled([
          api.getTracks({ limit: 5, sort: 'most_played' }),
          api.getTracks({ limit: 3 }),
          api.getSuggestedTracks(6),
          api.getPlaylists(),
          api.isWrappedEnabled(),
        ]);
        if (popularRes.status === 'fulfilled') {
          const v = popularRes.value;
          setPopularTracks(Array.isArray(v) ? v : v.tracks || []);
        }
        if (recentRes.status === 'fulfilled') {
          const v = recentRes.value;
          setRecentTracks(Array.isArray(v) ? v : v.tracks || []);
        }
        if (suggestedRes.status === 'fulfilled') {
          setSuggested(suggestedRes.value);
        }
        if (playlistRes.status === 'fulfilled') {
          setPlaylists(Array.isArray(playlistRes.value) ? playlistRes.value : []);
        }
        if (wrappedRes.status === 'fulfilled') {
          setWrappedEnabled(wrappedRes.value);
        }
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

      {(wrappedEnabled || isAdmin) && (
        <div className="wrapped-banner" onClick={() => navigate('/wrapped')}>
          <Sparkles size={20} />
          <div className="wrapped-banner__text">
            <span className="wrapped-banner__title">Your {new Date().getFullYear()} Wrapped</span>
            <span className="wrapped-banner__subtitle">See your listening stats</span>
          </div>
          <ChevronRight size={20} />
        </div>
      )}

      {loading ? (
        <div className="home__loading" style={{ color: '#6B6B6B', textAlign: 'center', padding: '3rem' }}>
          Loading...
        </div>
      ) : (
        <>
          {playlists.length > 0 && (
            <div className="section section--playlists">
              <div className="section__header">
                <h2 className="section__title">Your Playlists</h2>
                {playlists.length > 8 && (
                  <button className="section__see-all" onClick={() => navigate('/library')}>
                    See all
                  </button>
                )}
              </div>
              <div className="home__playlist-grid">
                {playlists.slice(0, 8).map((playlist) => {
                  const covers = (playlist.tracks || [])
                    .map((t) => t.cover_art_url)
                    .filter((url): url is string => !!url)
                    .filter((url, i, arr) => arr.indexOf(url) === i)
                    .slice(0, 4);

                  return (
                    <div
                      key={playlist.id}
                      className="home__playlist-item"
                      onClick={() => navigate(`/playlist/${playlist.id}`)}
                    >
                      <div className="home__playlist-art">
                        {playlist.cover_image ? (
                          <img src={playlist.cover_image} alt={playlist.name} />
                        ) : covers.length >= 4 ? (
                          <div className="home__playlist-mosaic">
                            {covers.map((url, i) => (
                              <img key={i} src={url} alt="" />
                            ))}
                          </div>
                        ) : covers.length > 0 ? (
                          <img src={covers[0]} alt={playlist.name} />
                        ) : (
                          <div className="home__playlist-art-placeholder">
                            <span>&#9835;</span>
                          </div>
                        )}
                      </div>
                      <div className="home__playlist-name">{playlist.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {popularTracks.length > 0 && (
            <div className="section section--featured">
              <h2 className="section__title">Popular Tracks</h2>
              <div className="scroll-row">
                {popularTracks.map(renderTrackCard)}
              </div>
            </div>
          )}

          {recentTracks.length > 0 && (
            <div className="section section--recent">
              <h2 className="section__title">Recently Added</h2>
              <div className="recent-list">
                {recentTracks.map((track, idx) => (
                  <div
                    key={track.id}
                    className="recent-row"
                    onClick={() => handlePlayTrack(track, recentTracks)}
                  >
                    <span className="recent-row__number">{idx + 1}</span>
                    <div className="recent-row__art">
                      {track.cover_art_url ? (
                        <img src={track.cover_art_url} alt={track.title} />
                      ) : (
                        <div
                          className="recent-row__art-placeholder"
                          style={{
                            background: 'linear-gradient(135deg, #F5E500, #242424)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%',
                          }}
                        >
                          <span style={{ fontSize: '1.2rem' }}>&#9835;</span>
                        </div>
                      )}
                    </div>
                    <div className="recent-row__info">
                      <div className="recent-row__title">{track.title}</div>
                      <div className="recent-row__artist">{track.artist}</div>
                    </div>
                    <span className="recent-row__badge">NEW</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggested.length > 0 && (
            <div className="section section--suggested">
              <h2 className="section__title">Suggested for You</h2>
              <div className="suggested-grid">
                {suggested.map((track) => (
                  <div
                    key={track.id}
                    className="suggested-card"
                    onClick={() => handlePlayTrack(track, suggested)}
                  >
                    <div className="suggested-card__art">
                      {track.cover_art_url ? (
                        <img src={track.cover_art_url} alt={track.title} />
                      ) : (
                        <div
                          className="suggested-card__art-placeholder"
                          style={{
                            background: 'linear-gradient(135deg, #F5E500, #242424)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%',
                          }}
                        >
                          <span style={{ fontSize: '1.5rem' }}>&#9835;</span>
                        </div>
                      )}
                      <div className="suggested-card__play">
                        <Play size={18} fill="#000" stroke="#000" />
                      </div>
                    </div>
                    <div className="suggested-card__title">{track.title}</div>
                    <div className="suggested-card__artist">{track.artist}</div>
                  </div>
                ))}
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
