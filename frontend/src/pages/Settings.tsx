import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import { LogOut, Shield, User, ChevronRight, Pencil, Heart, Copy, HelpCircle, Music } from 'lucide-react';
import { useToast } from '../components/Toast';

const Settings: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { crossfadeDuration, setCrossfadeDuration } = usePlayer();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} copied`, 'success');
    }).catch(() => {
      showToast('Failed to copy', 'error');
    });
  };

  const [supportOpen, setSupportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="settings">
      <h1 className="settings__title">Settings</h1>

      <div className="settings__section">
        <div className="settings__item">
          <div className="settings__item-icon">
            <User size={20} />
          </div>
          <div className="settings__item-content">
            <div className="settings__item-label">Account</div>
            <div className="settings__item-value">{user?.username}</div>
          </div>
        </div>

        <div
          className="settings__item settings__item--tap"
          onClick={() => navigate('/edit-profile')}
        >
          <div className="settings__item-icon">
            <Pencil size={20} />
          </div>
          <div className="settings__item-content">
            <div className="settings__item-label">Edit Profile</div>
            <div className="settings__item-value">Username, email & password</div>
          </div>
          <ChevronRight size={18} className="settings__item-chevron" />
        </div>

        {isAdmin && (
          <div
            className="settings__item settings__item--tap"
            onClick={() => navigate('/admin')}
          >
            <div className="settings__item-icon settings__item-icon--admin">
              <Shield size={20} />
            </div>
            <div className="settings__item-content">
              <div className="settings__item-label">Admin Panel</div>
              <div className="settings__item-value">Manage users & tracks</div>
            </div>
            <ChevronRight size={18} className="settings__item-chevron" />
          </div>
        )}
      </div>

      <div className="settings__section">
        <div className="settings__item">
          <div className="settings__item-icon">
            <Music size={20} />
          </div>
          <div className="settings__item-content" style={{ flex: 1 }}>
            <div className="settings__item-label">Crossfade</div>
            <div className="settings__item-value">
              {crossfadeDuration === 0 ? 'Off' : `${crossfadeDuration}s`}
            </div>
            <input
              type="range"
              className="settings__slider"
              min="0"
              max="12"
              step="1"
              value={crossfadeDuration}
              onChange={(e) => setCrossfadeDuration(parseInt(e.target.value))}
              style={{
                background: `linear-gradient(to right, #F5E500 0%, #F5E500 ${(crossfadeDuration / 12) * 100}%, #363636 ${(crossfadeDuration / 12) * 100}%, #363636 100%)`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="settings__section">
        <div
          className="settings__item settings__item--tap"
          onClick={() => setSupportOpen(!supportOpen)}
        >
          <div className="settings__item-icon settings__item-icon--support">
            <Heart size={20} />
          </div>
          <div className="settings__item-content">
            <div className="settings__item-label">Support the Developer</div>
            <div className="settings__item-value">Help keep Stopefy running</div>
          </div>
          <ChevronRight size={18} className="settings__item-chevron" style={{ transition: 'transform 0.2s', transform: supportOpen ? 'rotate(90deg)' : undefined }} />
        </div>

        {supportOpen && (
          <>
            <div
              className="settings__item settings__item--tap"
              onClick={() => copyToClipboard('09469562531', 'GCash number')}
            >
              <div className="settings__item-content" style={{ paddingLeft: 50 }}>
                <div className="settings__item-label">GCash</div>
                <div className="settings__item-value">Christopher Gacad — 0946 956 2531</div>
              </div>
              <Copy size={16} className="settings__item-chevron" />
            </div>

            <div
              className="settings__item settings__item--tap"
              onClick={() => copyToClipboard('2569439666', 'BPI account number')}
            >
              <div className="settings__item-content" style={{ paddingLeft: 50 }}>
                <div className="settings__item-label">BPI</div>
                <div className="settings__item-value">Christopher Gacad — 2569 439 666</div>
              </div>
              <Copy size={16} className="settings__item-chevron" />
            </div>
          </>
        )}
      </div>

      <div className="settings__section">
        <div
          className="settings__item settings__item--tap"
          onClick={() => setHelpOpen(!helpOpen)}
        >
          <div className="settings__item-icon settings__item-icon--help">
            <HelpCircle size={20} />
          </div>
          <div className="settings__item-content">
            <div className="settings__item-label">How to Add Music</div>
            <div className="settings__item-value">Can't find a song? Here's how</div>
          </div>
          <ChevronRight size={18} className="settings__item-chevron" style={{ transition: 'transform 0.2s', transform: helpOpen ? 'rotate(90deg)' : undefined }} />
        </div>

        {helpOpen && (
          <div className="settings__help-content">
            <div className="settings__help-step">
              <span className="settings__help-number">1</span>
              <div>
                <strong>Go to the Upload page</strong>
                <p>Tap the upload icon on the bottom navigation bar.</p>
              </div>
            </div>
            <div className="settings__help-step">
              <span className="settings__help-number">2</span>
              <div>
                <strong>Search via YouTube</strong>
                <p>Switch to the YouTube tab, search for any song, and tap download. The app will automatically add it to the library.</p>
              </div>
            </div>
            <div className="settings__help-step">
              <span className="settings__help-number">3</span>
              <div>
                <strong>Or upload a file</strong>
                <p>If you have an MP3 or audio file on your device, tap "Choose File" on the Upload tab to add it directly.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="settings__section">
        <div
          className="settings__item settings__item--tap settings__item--danger"
          onClick={handleLogout}
        >
          <div className="settings__item-icon settings__item-icon--danger">
            <LogOut size={20} />
          </div>
          <div className="settings__item-content">
            <div className="settings__item-label">Log Out</div>
          </div>
        </div>
      </div>

      <div className="settings__watermark">
        <img src="/web/icon-192.png" alt="Stopefy" className="settings__watermark-icon" />
        <span className="settings__watermark-name">Stopefy</span>
        <span className="settings__watermark-version">v1.0.0</span>
      </div>
    </div>
  );
};

export default Settings;
