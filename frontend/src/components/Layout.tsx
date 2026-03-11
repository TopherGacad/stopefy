import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Player from './Player';
import InstallPrompt from './InstallPrompt';
import { usePlayer } from '../contexts/PlayerContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentTrack } = usePlayer();
  const location = useLocation();
  const isNowPlaying = location.pathname === '/now-playing';
  const showPlayer = currentTrack && !isNowPlaying;

  return (
    <div className={`layout${showPlayer ? ' layout--player-active' : ''}`}>
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
      {showPlayer && <Player />}
      <InstallPrompt />
    </div>
  );
};

export default Layout;
