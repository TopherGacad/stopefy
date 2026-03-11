import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import { WrappedData } from '../types';
import { ChevronLeft, ChevronRight, Music, Clock, Mic2, Disc3, Star, BarChart3, X, Sparkles } from 'lucide-react';

const SLIDE_GRADIENTS = [
  'linear-gradient(135deg, #F5E500, #242424)',
  'linear-gradient(135deg, #F5E500, #2E2E2E)',
  'linear-gradient(135deg, #d4c400, #1A1A1A)',
  'linear-gradient(135deg, #2E2E2E, #F5E500)',
  'linear-gradient(135deg, #FFD700, #1A1A1A)',
  'linear-gradient(135deg, #242424, #000000)',
];

const TOTAL_SLIDES = 6;

function isWrappedSeason(): boolean {
  const now = new Date();
  return now.getMonth() === 11 && now.getDate() <= 7; // Dec 1–7
}

const Wrapped: React.FC = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  useEffect(() => {
    const fetchWrapped = async () => {
      setLoading(true);
      try {
        const result = await api.getWrapped(year);
        setData(result);
      } catch (err) {
        console.error('Failed to fetch wrapped data:', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchWrapped();
    setCurrentSlide(0);
  }, [year]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const goToNext = () => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  const totalMinutes = data?.total_minutes ?? 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = (totalMinutes / 1440).toFixed(1);

  const hasData = data && (totalMinutes > 0 || (data.top_artists && data.top_artists.length > 0) || (data.top_tracks && data.top_tracks.length > 0));

  if (!isWrappedSeason()) {
    return (
      <div className="wrapped" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center', padding: '2rem', position: 'relative' }}>
        <button
          onClick={() => navigate('/')}
          style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'rgba(107, 107, 107, 0.15)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
        <Sparkles size={64} style={{ color: '#F5E500', marginBottom: '1.5rem', opacity: 0.7 }} />
        <h2 style={{ color: '#FFFFFF', fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Wrapped is Coming!
        </h2>
        <p style={{ color: '#6B6B6B', fontSize: '1.1rem', maxWidth: '400px', lineHeight: 1.6 }}>
          Your {currentYear} Wrapped will be available during the first week of December. Keep listening and check back then!
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="wrapped" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', color: '#6B6B6B', position: 'relative' }}>
        <button
          onClick={() => navigate('/')}
          style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'rgba(107, 107, 107, 0.15)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
        Loading your wrapped...
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="wrapped" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center', padding: '2rem', position: 'relative' }}>
        <button
          onClick={() => navigate('/')}
          style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'rgba(107, 107, 107, 0.15)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
        <div style={{ marginBottom: '1.5rem' }}>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{
              background: '#2E2E2E',
              color: '#FFFFFF',
              border: '1px solid #363636',
              borderRadius: '0.5rem',
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <BarChart3 size={64} style={{ color: '#6B6B6B', marginBottom: '1.5rem', opacity: 0.5 }} />
        <p style={{ color: '#FFFFFF', fontSize: '1.3rem', marginBottom: '0.5rem' }}>
          No listening data for {year} yet
        </p>
        <p style={{ color: '#6B6B6B', fontSize: '0.95rem' }}>
          Start listening to get your wrapped!
        </p>
      </div>
    );
  }

  return (
    <div className="wrapped" style={{ position: 'relative', minHeight: '80vh', overflow: 'hidden' }}>
      {/* Close button */}
      <button
        onClick={() => navigate('/')}
        style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 20, background: 'rgba(107, 107, 107, 0.15)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', cursor: 'pointer', backdropFilter: 'blur(10px)' }}
      >
        <X size={20} />
      </button>
      {/* Year selector */}
      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 20 }}>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{
            background: '#2E2E2E',
            color: '#FFFFFF',
            border: '1px solid #363636',
            borderRadius: '0.5rem',
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
          }}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Slides */}
      <div style={{ position: 'relative', width: '100%', minHeight: '80vh' }}>
        {/* Slide 0: Intro */}
        <div
          className={`wrapped__slide wrapped__slide--intro ${currentSlide === 0 ? 'wrapped__slide--active' : ''}`}
          style={{
            display: currentSlide === 0 ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            background: SLIDE_GRADIENTS[0],
            borderRadius: '1rem',
            padding: '3rem 2rem',
            textAlign: 'center',
          }}
        >
          <h1
            className={currentSlide === 0 ? 'animate-scale-in' : ''}
            style={{
              fontSize: '3.5rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #ffffff, #F5E500)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '1rem',
            }}
          >
            Your {year} Wrapped
          </h1>
          <p
            className={currentSlide === 0 ? 'animate-fade-in' : ''}
            style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.3rem' }}
          >
            Let&apos;s see what you&apos;ve been listening to.
          </p>
        </div>

        {/* Slide 1: Total Time */}
        <div
          className={`wrapped__slide wrapped__slide--time ${currentSlide === 1 ? 'wrapped__slide--active' : ''}`}
          style={{
            display: currentSlide === 1 ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            background: SLIDE_GRADIENTS[1],
            borderRadius: '1rem',
            padding: '3rem 2rem',
            textAlign: 'center',
          }}
        >
          <Clock size={48} style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1.5rem' }} className={currentSlide === 1 ? 'animate-fade-in' : ''} />
          <div
            className={currentSlide === 1 ? 'animate-scale-in' : ''}
            style={{ fontSize: '5rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1, marginBottom: '1rem' }}
          >
            {totalMinutes.toLocaleString()}
          </div>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.3rem', marginBottom: '0.5rem' }}>
            minutes of music this year
          </p>
          <p
            className={currentSlide === 1 ? 'animate-slide-up' : ''}
            style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.3rem', marginBottom: '0.5rem' }}
          >
            You listened to {hours}h {minutes}m of music this year
          </p>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.1rem' }}>
            That&apos;s about {days} days!
          </p>
        </div>

        {/* Slide 2: Top Artists */}
        <div
          className={`wrapped__slide wrapped__slide--artists ${currentSlide === 2 ? 'wrapped__slide--active' : ''}`}
          style={{
            display: currentSlide === 2 ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            background: SLIDE_GRADIENTS[2],
            borderRadius: '1rem',
            padding: '3rem 2rem',
            textAlign: 'center',
          }}
        >
          <Mic2 size={40} style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1rem' }} />
          <h2
            className={currentSlide === 2 ? 'animate-fade-in' : ''}
            style={{ color: '#ffffff', fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}
          >
            Your Top Artists
          </h2>
          <div style={{ width: '100%', maxWidth: '500px' }}>
            {(data.top_artists || []).map((artist: any, index: number) => (
              <div
                key={artist.name || index}
                className={currentSlide === 2 ? 'animate-slide-up' : ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '0.75rem',
                  marginBottom: '0.75rem',
                  animationDelay: `${index * 0.15}s`,
                  animationFillMode: 'both',
                }}
              >
                <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700, fontSize: '1.3rem', width: '2rem', textAlign: 'center' }}>
                  {index + 1}
                </span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '1.05rem' }}>
                    {artist.name}
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                    {artist.play_count ?? 0} plays &bull; {artist.minutes ?? 0} min
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Slide 3: Top Tracks */}
        <div
          className={`wrapped__slide wrapped__slide--tracks ${currentSlide === 3 ? 'wrapped__slide--active' : ''}`}
          style={{
            display: currentSlide === 3 ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            background: SLIDE_GRADIENTS[3],
            borderRadius: '1rem',
            padding: '3rem 2rem',
            textAlign: 'center',
          }}
        >
          <Music size={40} style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1rem' }} />
          <h2
            className={currentSlide === 3 ? 'animate-fade-in' : ''}
            style={{ color: '#ffffff', fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}
          >
            Your Top Tracks
          </h2>
          <div style={{ width: '100%', maxWidth: '500px' }}>
            {(data.top_tracks || []).map((track: any, index: number) => (
              <div
                key={track.title || index}
                className={currentSlide === 3 ? 'animate-slide-up' : ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '0.75rem',
                  marginBottom: '0.75rem',
                  animationDelay: `${index * 0.15}s`,
                  animationFillMode: 'both',
                }}
              >
                <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700, fontSize: '1.3rem', width: '2rem', textAlign: 'center' }}>
                  {index + 1}
                </span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '1.05rem' }}>
                    {track.title}
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                    {track.artist} &bull; {track.play_count ?? 0} plays
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Slide 4: Top Genres */}
        <div
          className={`wrapped__slide wrapped__slide--genres ${currentSlide === 4 ? 'wrapped__slide--active' : ''}`}
          style={{
            display: currentSlide === 4 ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            background: SLIDE_GRADIENTS[4],
            borderRadius: '1rem',
            padding: '3rem 2rem',
            textAlign: 'center',
          }}
        >
          <Disc3 size={40} style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1rem' }} />
          <h2
            className={currentSlide === 4 ? 'animate-fade-in' : ''}
            style={{ color: '#ffffff', fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}
          >
            Your Top Genres
          </h2>
          <div
            className={currentSlide === 4 ? 'animate-scale-in' : ''}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.75rem',
              maxWidth: '600px',
            }}
          >
            {(data.top_genres || []).map((genre: any, index: number) => {
              const maxCount = Math.max(...(data.top_genres || []).map((g: any) => g.play_count || g.count || 1));
              const count = genre.play_count || genre.count || 1;
              const scale = 0.7 + (count / maxCount) * 0.6;
              return (
                <div
                  key={genre.name || index}
                  style={{
                    padding: `${0.5 * scale}rem ${1.2 * scale}rem`,
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '2rem',
                    color: '#ffffff',
                    fontSize: `${0.9 * scale}rem`,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {genre.name} ({count})
                </div>
              );
            })}
          </div>
        </div>

        {/* Slide 5: Summary */}
        <div
          className={`wrapped__slide wrapped__slide--summary ${currentSlide === 5 ? 'wrapped__slide--active' : ''}`}
          style={{
            display: currentSlide === 5 ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            background: SLIDE_GRADIENTS[5],
            borderRadius: '1rem',
            padding: '3rem 2rem',
            textAlign: 'center',
          }}
        >
          <Star size={40} style={{ color: '#F5E500', marginBottom: '1rem' }} />
          <h2
            className={currentSlide === 5 ? 'animate-fade-in' : ''}
            style={{ color: '#ffffff', fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}
          >
            Your {year} Summary
          </h2>
          <div
            className={currentSlide === 5 ? 'animate-scale-in' : ''}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '1rem',
              padding: '2rem',
              width: '100%',
              maxWidth: '400px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              <div>
                <div style={{ color: '#6B6B6B', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Minutes</div>
                <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700 }}>{totalMinutes.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: '#6B6B6B', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Tracks Played</div>
                <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700 }}>{(data.total_tracks_played ?? 0).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: '#6B6B6B', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unique Tracks</div>
                <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700 }}>{(data.total_unique_tracks ?? 0).toLocaleString()}</div>
              </div>
              {data.top_artists && data.top_artists.length > 0 && (
                <div>
                  <div style={{ color: '#6B6B6B', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Artist</div>
                  <div style={{ color: '#F5E500', fontSize: '1.3rem', fontWeight: 700 }}>{data.top_artists[0].name}</div>
                </div>
              )}
              {data.top_tracks && data.top_tracks.length > 0 && (
                <div>
                  <div style={{ color: '#6B6B6B', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Track</div>
                  <div style={{ color: '#d4c400', fontSize: '1.3rem', fontWeight: 700 }}>{data.top_tracks[0].track.title}</div>
                </div>
              )}
              {data.top_genres && data.top_genres.length > 0 && (
                <div>
                  <div style={{ color: '#6B6B6B', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Genre</div>
                  <div style={{ color: '#6B6B6B', fontSize: '1.3rem', fontWeight: 700 }}>{data.top_genres[0].genre}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {currentSlide > 0 && (
        <button
          onClick={goToPrev}
          style={{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(26, 26, 26, 0.7)',
            border: 'none',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: 'pointer',
            zIndex: 10,
            backdropFilter: 'blur(10px)',
          }}
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {currentSlide < TOTAL_SLIDES - 1 && (
        <button
          onClick={goToNext}
          style={{
            position: 'absolute',
            right: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(26, 26, 26, 0.7)',
            border: 'none',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: 'pointer',
            zIndex: 10,
            backdropFilter: 'blur(10px)',
          }}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Dot Indicators */}
      <div
        style={{
          position: 'absolute',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '0.5rem',
          zIndex: 10,
        }}
      >
        {Array.from({ length: TOTAL_SLIDES }).map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            style={{
              width: currentSlide === index ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              background: currentSlide === index ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Wrapped;
