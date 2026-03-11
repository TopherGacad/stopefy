import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Shield, User, ChevronRight } from 'lucide-react';

const Settings: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

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
    </div>
  );
};

export default Settings;
