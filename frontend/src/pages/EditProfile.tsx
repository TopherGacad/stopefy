import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import * as api from '../api';

const EditProfile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const updates: { username?: string; email?: string } = {};
    if (username !== user?.username) updates.username = username;
    if (email !== user?.email) updates.email = email;

    if (Object.keys(updates).length === 0) {
      showToast('No changes to save', 'info');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateProfile(updates);
      updateUser(updated);
      showToast('Profile updated', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      showToast('Enter your current password', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      showToast('Password changed successfully', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to change password', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="edit-profile">
      <div className="edit-profile__header">
        <button className="edit-profile__back" onClick={() => navigate('/settings')}>
          <ChevronLeft size={24} />
        </button>
        <h1 className="edit-profile__title">Edit Profile</h1>
      </div>

      <form className="edit-profile__section" onSubmit={handleSaveProfile}>
        <h2 className="edit-profile__section-title">Profile Info</h2>

        <div className="edit-profile__field">
          <label className="edit-profile__label">Username</label>
          <input
            className="edit-profile__input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
          />
        </div>

        <div className="edit-profile__field">
          <label className="edit-profile__label">Email</label>
          <input
            className="edit-profile__input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
        </div>

        <button
          type="submit"
          className={`edit-profile__save${saving ? ' edit-profile__save--loading' : ''}`}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <form className="edit-profile__section" onSubmit={handleChangePassword}>
        <h2 className="edit-profile__section-title">Change Password</h2>

        <div className="edit-profile__field">
          <label className="edit-profile__label">Current Password</label>
          <div className="edit-profile__input-wrapper">
            <input
              className="edit-profile__input"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
            <button
              type="button"
              className="edit-profile__toggle-pw"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="edit-profile__field">
          <label className="edit-profile__label">New Password</label>
          <div className="edit-profile__input-wrapper">
            <input
              className="edit-profile__input"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
            <button
              type="button"
              className="edit-profile__toggle-pw"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="edit-profile__field">
          <label className="edit-profile__label">Confirm New Password</label>
          <input
            className="edit-profile__input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />
        </div>

        <button
          type="submit"
          className={`edit-profile__save edit-profile__save--secondary${changingPassword ? ' edit-profile__save--loading' : ''}`}
          disabled={changingPassword}
        >
          {changingPassword ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
};

export default EditProfile;
