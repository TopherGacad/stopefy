import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../api';
import { Playlist } from '../types';
import { Home, Search, Library, Plus, LogOut, Music, ListMusic, Upload, Users, X } from 'lucide-react';

const SWIPE_THRESHOLD = 80;

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  const closeDrawer = useCallback(() => {
    setDrawerClosing(true);
    setTimeout(() => {
      setDrawerOpen(false);
      setDrawerClosing(false);
      setDragY(0);
    }, 200);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    // Only allow dragging down (positive delta)
    setDragY(Math.max(0, delta));
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (dragY > SWIPE_THRESHOLD) {
      closeDrawer();
    } else {
      setDragY(0);
    }
  }, [dragY, closeDrawer]);

  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const data = await api.getPlaylists();
        setPlaylists(Array.isArray(data) ? data : []);
      } catch (err) {
        // Silently fail - playlists are non-critical
      }
    };
    fetchPlaylists();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreatePlaylist = async () => {
    setDrawerOpen(false);
    try {
      const playlist = await api.createPlaylist('New Playlist');
      navigate(`/playlist/${playlist.id}`);
    } catch {
      // fallback to library
      navigate('/library');
    }
  };

  const handleUpload = () => {
    setDrawerOpen(false);
    navigate('/upload');
  };

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    'sidebar__nav-item' + (isActive ? ' sidebar__nav-item--active' : '');

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar__logo">
          <Music size={28} />
          Stopefy
        </div>

        <nav className="sidebar__nav">
          <NavLink to="/" end className={navLinkClassName}>
            <Home size={20} />
            Home
          </NavLink>
          <NavLink to="/search" className={navLinkClassName}>
            <Search size={20} />
            Search
          </NavLink>
          <button
            className="sidebar__nav-item sidebar__create-btn"
            onClick={() => setDrawerOpen(true)}
          >
            <Plus size={20} />
            Create
          </button>
          <NavLink to="/library" className={navLinkClassName}>
            <Library size={20} />
            Library
          </NavLink>
        </nav>

        <div className="sidebar__divider" />

        <div className="sidebar__section-title">Your Playlists</div>
        <div className="sidebar__playlists">
          {playlists.length > 0 ? (
            playlists.map((playlist) => (
              <NavLink
                key={playlist.id}
                to={`/playlist/${playlist.id}`}
                className="sidebar__playlist-item"
              >
                <ListMusic size={16} />
                {playlist.name}
              </NavLink>
            ))
          ) : (
            <div className="sidebar__playlist-item">No playlists yet</div>
          )}
        </div>

        {user && (
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="sidebar__username">{user.username}</span>
            <button className="sidebar__logout" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        )}
      </aside>

      {/* Create Drawer */}
      {drawerOpen && (
        <div
          className={'create-drawer__overlay' + (drawerClosing ? ' create-drawer__overlay--closing' : '')}
          onClick={closeDrawer}
        >
          <div
            className={'create-drawer' + (drawerClosing ? ' create-drawer--closing' : '')}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
          >
            <div className="create-drawer__handle" />
            <div className="create-drawer__header">
              <h3 className="create-drawer__title">Create</h3>
              <button className="create-drawer__close" onClick={closeDrawer}>
                <X size={20} />
              </button>
            </div>
            <div className="create-drawer__options">
              <button className="create-drawer__option" onClick={handleCreatePlaylist}>
                <div className="create-drawer__option-icon">
                  <ListMusic size={22} />
                </div>
                <div className="create-drawer__option-text">
                  <span className="create-drawer__option-label">Create Playlist</span>
                  <span className="create-drawer__option-desc">Build a playlist with songs</span>
                </div>
              </button>
              <button className="create-drawer__option" onClick={handleUpload}>
                <div className="create-drawer__option-icon">
                  <Upload size={22} />
                </div>
                <div className="create-drawer__option-text">
                  <span className="create-drawer__option-label">Upload Music</span>
                  <span className="create-drawer__option-desc">Add your own audio files</span>
                </div>
              </button>
              <button className="create-drawer__option create-drawer__option--disabled">
                <div className="create-drawer__option-icon">
                  <Users size={22} />
                </div>
                <div className="create-drawer__option-text">
                  <span className="create-drawer__option-label">Create Collab</span>
                  <span className="create-drawer__option-desc">Coming soon</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
