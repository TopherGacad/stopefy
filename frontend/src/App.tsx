import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlayerProvider } from './contexts/PlayerContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import Upload from './pages/Upload';
import PlaylistView from './pages/PlaylistView';
import Wrapped from './pages/Wrapped';
import Auth from './pages/Auth';
import Admin from './pages/Admin';
import SettingsPage from './pages/Settings';
import NowPlaying from './pages/NowPlaying';
import { ToastProvider } from './components/Toast';
import './App.css';

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function PublicRoute() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PlayerProvider>
          <ToastProvider>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Auth mode="login" />} />
              <Route path="/register" element={<Auth mode="register" />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/library" element={<Library />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/playlist/:id" element={<PlaylistView />} />
              <Route path="/wrapped" element={<Wrapped />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/now-playing" element={<NowPlaying />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
        </PlayerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
