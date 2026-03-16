import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import { WrappedData } from '../types';
import { X, BarChart3, Sparkles } from 'lucide-react';

const TOTAL_SLIDES = 6;

const SLIDE_BG = [
  'linear-gradient(150deg, #0D0D0D 0%, #1a0a2e 50%, #16213e 100%)',
  'linear-gradient(150deg, #0f2027 0%, #203a43 40%, #2c5364 100%)',
  'linear-gradient(150deg, #1a0a2e 0%, #3d1c6e 50%, #6c2eb9 100%)',
  'linear-gradient(150deg, #0c0c1d 0%, #1b1464 50%, #2e1065 100%)',
  'linear-gradient(150deg, #0d1117 0%, #1a3a2a 50%, #0f5132 100%)',
  'linear-gradient(150deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
];

const ACCENT_COLORS = ['#F5E500', '#00CED1', '#c77dff', '#7c6aef', '#1DB954', '#FF6B6B'];

function isWrappedSeason(): boolean {
  return true;
}

/* Decorative floating shapes */
const Shapes: React.FC<{ color: string; slide: number }> = ({ color, slide }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
    <div style={{
      position: 'absolute', width: 220, height: 220, borderRadius: '50%',
      background: `radial-gradient(circle, ${color}22, transparent 70%)`,
      top: '-60px', right: '-40px',
    }} />
    <div style={{
      position: 'absolute', width: 160, height: 160, borderRadius: '50%',
      border: `2px solid ${color}18`,
      bottom: '15%', left: '-30px',
    }} />
    <div style={{
      position: 'absolute', width: 300, height: 300, borderRadius: '50%',
      background: `radial-gradient(circle, ${color}10, transparent 70%)`,
      bottom: '-100px', right: '-60px',
    }} />
    {slide % 2 === 0 && (
      <div style={{
        position: 'absolute', width: 80, height: 80,
        border: `2px solid ${color}15`, borderRadius: '12px',
        top: '25%', left: '8%', transform: 'rotate(35deg)',
      }} />
    )}
    {slide % 2 === 1 && (
      <div style={{
        position: 'absolute', width: 50, height: 50,
        background: `${color}0A`, borderRadius: '50%',
        top: '18%', right: '12%',
      }} />
    )}
  </div>
);

const Wrapped: React.FC = () => {
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  useEffect(() => {
    const fetchWrapped = async () => {
      setLoading(true);
      try {
        const result = await api.getWrapped(year);
        setData(result);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchWrapped();
  }, [year]);

  const goToNext = useCallback(() => {
    setCurrentSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1));
  }, []);
  const goToPrev = useCallback(() => {
    setCurrentSlide((s) => Math.max(s - 1, 0));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/');
      else if (e.key === 'ArrowRight') goToNext();
      else if (e.key === 'ArrowLeft') goToPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, goToNext, goToPrev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (touchDeltaX.current < -50) goToNext();
    else if (touchDeltaX.current > 50) goToPrev();
  };

  const totalMinutes = data?.total_minutes ?? 0;
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  const days = (totalMinutes / 1440).toFixed(1);
  const hasData = data && (totalMinutes > 0 || (data.top_artists?.length ?? 0) > 0 || (data.top_tracks?.length ?? 0) > 0);

  const accent = ACCENT_COLORS[currentSlide] || '#F5E500';

  /* Shared slide wrapper */
  const slideStyle = (i: number): React.CSSProperties => ({
    display: currentSlide === i ? 'flex' : 'none',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    height: '100%',
    background: SLIDE_BG[i],
    overflow: 'hidden',
  });

  const scrollSlideStyle = (i: number): React.CSSProperties => ({
    ...slideStyle(i),
    overflowY: 'auto',
    justifyContent: 'flex-start',
  });

  /* Close button */
  const CloseBtn = () => (
    <button
      onClick={() => navigate('/')}
      style={{
        position: 'absolute', top: 16, left: 16, zIndex: 20,
        background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%',
        width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', cursor: 'pointer',
      }}
    >
      <X size={18} />
    </button>
  );


  const portal = (content: React.ReactNode) => createPortal(content, document.body);

  if (!isWrappedSeason()) {
    return portal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0D0D0D', textAlign: 'center', padding: '2rem' }}>
        <CloseBtn />
        <Sparkles size={64} style={{ color: '#F5E500', marginBottom: '1.5rem', opacity: 0.7 }} />
        <h2 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>Wrapped is Coming!</h2>
        <p style={{ color: '#6B6B6B', fontSize: '1.1rem', maxWidth: 400, lineHeight: 1.6 }}>
          Your {year} Wrapped will be available during the first week of December.
        </p>
      </div>
    );
  }

  if (loading) {
    return portal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D0D0D', color: '#6B6B6B' }}>
        <CloseBtn />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="loading-spinner" />
          Loading your wrapped...
        </div>
      </div>
    );
  }

  if (!hasData) {
    return portal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0D0D0D', textAlign: 'center', padding: '2rem' }}>
        <CloseBtn />
        <BarChart3 size={64} style={{ color: '#6B6B6B', marginBottom: '1.5rem', opacity: 0.5 }} />
        <p style={{ color: '#fff', fontSize: '1.3rem', marginBottom: 8 }}>No listening data for {year} yet</p>
        <p style={{ color: '#6B6B6B', fontSize: '0.95rem' }}>Start listening to get your wrapped!</p>
      </div>
    );
  }

  const topArtists = data.top_artists || [];
  const topTracks = data.top_tracks || [];
  const topGenres = data.top_genres || [];
  const maxTrackPlays = Math.max(...topTracks.map((t) => t.plays || 1), 1);
  const GENRE_COLORS = ['#F5E500', '#00CED1', '#c77dff', '#FF6B6B', '#1DB954', '#FF8C00', '#FF69B4', '#7c6aef'];

  return portal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, overflow: 'hidden', background: '#0D0D0D' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <CloseBtn />

      {/* ===== Slide 0: Intro ===== */}
      <div style={slideStyle(0)}>
        <Shapes color={ACCENT_COLORS[0]} slide={0} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', zIndex: 1 }}>
          <div style={{
            width: 90, height: 90, borderRadius: '24px', background: `linear-gradient(135deg, ${ACCENT_COLORS[0]}, #d4a017)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
            boxShadow: `0 0 60px ${ACCENT_COLORS[0]}40`,
            transform: 'rotate(-5deg)',
          }}>
            <Sparkles size={40} color="#1A1A1A" />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-brand)', fontSize: 'clamp(2.2rem, 8vw, 3.5rem)',
            color: '#fff', textAlign: 'center', marginBottom: 12, lineHeight: 1.1,
          }}>
            Your <span style={{ color: ACCENT_COLORS[0] }}>{year}</span> Wrapped
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', textAlign: 'center' }}>
            Let&apos;s see what you&apos;ve been listening to.
          </p>
          <div style={{ marginTop: 40, display: 'flex', gap: 8, alignItems: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
            <span>Swipe to explore</span>
            <span style={{ display: 'inline-block', animation: 'wrappedBounceRight 1.5s ease infinite' }}>&rarr;</span>
          </div>
        </div>
      </div>

      {/* ===== Slide 1: Total Time ===== */}
      <div style={slideStyle(1)}>
        <Shapes color={ACCENT_COLORS[1]} slide={1} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', zIndex: 1 }}>
          <div style={{ color: ACCENT_COLORS[1], fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>
            Total Listening Time
          </div>
          <div style={{
            fontFamily: 'var(--font-brand)', fontSize: 'clamp(3.5rem, 14vw, 6rem)',
            color: '#fff', lineHeight: 1, marginBottom: 4,
          }}>
            {Math.round(totalMinutes).toLocaleString()}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', marginBottom: 32 }}>
            minutes
          </div>
          {/* Visual breakdown */}
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Hours', value: hours },
              { label: 'Days', value: days },
              { label: 'Tracks', value: data.total_tracks_played ?? 0 },
            ].map((item) => (
              <div key={item.label} style={{
                background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 20px',
                minWidth: 90, textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '1.5rem', color: ACCENT_COLORS[1] }}>
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Slide 2: Top Artists ===== */}
      <div style={scrollSlideStyle(2)}>
        <Shapes color={ACCENT_COLORS[2]} slide={2} />
        <div style={{ width: '100%', maxWidth: 380, padding: '60px 20px 80px', zIndex: 1 }}>
          <div style={{ color: ACCENT_COLORS[2], fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8, textAlign: 'center' }}>
            Most Played
          </div>
          <h2 style={{ fontFamily: 'var(--font-brand)', color: '#fff', fontSize: '1.6rem', textAlign: 'center', marginBottom: 24 }}>
            Your Top Artists
          </h2>
          {/* #1 spotlight */}
          {topArtists.length > 0 && (() => {
            const a = topArtists[0];
            return (
              <div style={{
                background: `linear-gradient(135deg, ${ACCENT_COLORS[2]}18, ${ACCENT_COLORS[2]}08)`,
                border: `1px solid ${ACCENT_COLORS[2]}30`,
                borderRadius: 20, padding: '24px 16px 20px', textAlign: 'center', marginBottom: 16,
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${ACCENT_COLORS[2]}, ${ACCENT_COLORS[2]}88)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px', fontSize: '1.8rem', fontWeight: 800, color: '#fff',
                  boxShadow: `0 0 40px ${ACCENT_COLORS[2]}30`,
                }}>
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ background: ACCENT_COLORS[2], color: '#000', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', borderRadius: 20, padding: '3px 10px', display: 'inline-block', marginBottom: 8 }}>
                  #1 Artist
                </div>
                <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>{a.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                  {a.plays} plays &bull; {Math.round(a.minutes)} min
                </div>
              </div>
            );
          })()}
          {/* #2-3 side by side */}
          {topArtists.length > 1 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              {topArtists.slice(1, 3).map((a, i) => (
                <div key={a.name} style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14, padding: '14px 8px', textAlign: 'center',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: `${ACCENT_COLORS[2]}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 8px', fontSize: '1rem', fontWeight: 700, color: ACCENT_COLORS[2],
                  }}>
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', fontWeight: 700 }}>#{i + 2}</div>
                  <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>{a.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>{a.plays} plays</div>
                </div>
              ))}
            </div>
          )}
          {/* #4+ compact */}
          {topArtists.length > 3 && topArtists.slice(3).map((a, i) => (
            <div key={a.name} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 700, fontSize: '0.8rem', width: 20, textAlign: 'center' }}>{i + 4}</span>
              <div style={{ flex: 1, color: '#fff', fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', flexShrink: 0 }}>{a.plays}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Slide 3: Top Tracks ===== */}
      <div style={scrollSlideStyle(3)}>
        <Shapes color={ACCENT_COLORS[3]} slide={3} />
        <div style={{ width: '100%', maxWidth: 380, padding: '60px 20px 80px', zIndex: 1 }}>
          <div style={{ color: ACCENT_COLORS[3], fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8, textAlign: 'center' }}>
            On Repeat
          </div>
          <h2 style={{ fontFamily: 'var(--font-brand)', color: '#fff', fontSize: '1.6rem', textAlign: 'center', marginBottom: 24 }}>
            Your Top Tracks
          </h2>
          {topTracks.map((track, i) => {
            const barWidth = Math.max(8, (track.plays / maxTrackPlays) * 100);
            const isTop = i === 0;
            return (
              <div key={track.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: isTop ? '14px 14px' : '10px 12px',
                background: isTop ? `${ACCENT_COLORS[3]}10` : (i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'),
                border: isTop ? `1px solid ${ACCENT_COLORS[3]}25` : 'none',
                borderRadius: 12, marginBottom: 6,
              }}>
                <span style={{
                  color: isTop ? ACCENT_COLORS[3] : 'rgba(255,255,255,0.25)',
                  fontWeight: 700, fontSize: isTop ? '1.1rem' : '0.8rem', width: 24, textAlign: 'center', flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: '#fff', fontSize: isTop ? '0.95rem' : '0.85rem', fontWeight: isTop ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {track.title}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {track.artist}
                  </div>
                  {/* Bar chart */}
                  <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, width: `${barWidth}%`,
                      background: isTop ? ACCENT_COLORS[3] : `${ACCENT_COLORS[3]}60`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', flexShrink: 0 }}>
                  {track.plays}x
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== Slide 4: Top Genres ===== */}
      <div style={slideStyle(4)}>
        <Shapes color={ACCENT_COLORS[4]} slide={4} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', zIndex: 1 }}>
          <div style={{ color: ACCENT_COLORS[4], fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>
            Your Sound
          </div>
          <h2 style={{ fontFamily: 'var(--font-brand)', color: '#fff', fontSize: '1.6rem', marginBottom: 32 }}>
            Top Genres
          </h2>
          {/* Genre bubbles with proportional sizing */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, maxWidth: 360 }}>
            {topGenres.map((genre, i) => {
              const maxPlays = Math.max(...topGenres.map((g) => g.plays || 1));
              const ratio = (genre.plays || 1) / maxPlays;
              const size = 70 + ratio * 60;
              const gc = GENRE_COLORS[i % GENRE_COLORS.length];
              return (
                <div key={genre.genre || i} style={{
                  width: size, height: size, borderRadius: '50%',
                  background: `${gc}15`, border: `2px solid ${gc}40`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform 0.3s ease',
                }}>
                  <div style={{ color: gc, fontWeight: 700, fontSize: ratio > 0.7 ? '0.85rem' : '0.75rem', textAlign: 'center', lineHeight: 1.2, padding: '0 4px' }}>
                    {genre.genre}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', marginTop: 2 }}>
                    {genre.plays}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== Slide 5: Summary ===== */}
      <div style={slideStyle(5)}>
        <Shapes color={ACCENT_COLORS[5]} slide={5} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', zIndex: 1 }}>
          <div style={{ color: ACCENT_COLORS[5], fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>
            The Full Picture
          </div>
          <h2 style={{ fontFamily: 'var(--font-brand)', color: '#fff', fontSize: '1.6rem', marginBottom: 28 }}>
            Your {year} Summary
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, width: '100%', maxWidth: 340 }}>
            {[
              { label: 'Minutes', value: Math.round(totalMinutes).toLocaleString(), color: '#00CED1' },
              { label: 'Tracks Played', value: (data.total_tracks_played ?? 0).toLocaleString(), color: '#c77dff' },
              { label: 'Unique Tracks', value: (data.total_unique_tracks ?? 0).toLocaleString(), color: '#1DB954' },
              { label: hours > 0 ? 'Hours' : 'Minutes', value: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`, color: '#F5E500' },
            ].map((item) => (
              <div key={item.label} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 16, padding: '18px 14px', textAlign: 'center',
              }}>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '1.4rem', color: item.color, marginBottom: 4 }}>
                  {item.value}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
          {/* Highlights */}
          <div style={{ width: '100%', maxWidth: 340, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topArtists.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '12px 14px',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #c77dff, #7c6aef)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {topArtists[0].name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top Artist</div>
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>{topArtists[0].name}</div>
                </div>
              </div>
            )}
            {topTracks.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '12px 14px',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #F5E500, #d4a017)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#1A1A1A', flexShrink: 0 }}>
                  #1
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top Track</div>
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topTracks[0].title}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar + dots */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, padding: '0 0 24px' }}>
        {/* Thin progress line */}
        <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', margin: '0 20px 16px' }}>
          <div style={{
            height: '100%', borderRadius: 1,
            background: accent,
            width: `${((currentSlide + 1) / TOTAL_SLIDES) * 100}%`,
            transition: 'width 0.3s ease, background 0.3s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              style={{
                width: currentSlide === i ? 20 : 6, height: 6,
                borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer',
                background: currentSlide === i ? accent : 'rgba(255,255,255,0.2)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Wrapped;
