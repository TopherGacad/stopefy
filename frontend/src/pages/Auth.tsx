import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { Eye, EyeOff, Clock } from 'lucide-react';

function friendlyError(raw: string): string {
  const msg = (raw || '').toLowerCase();

  // Network / connectivity
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network error'))
    return 'Unable to connect to the server. Please check your internet connection.';
  if (msg.includes('you may be offline'))
    return 'You appear to be offline. Please check your connection and try again.';
  if (msg.includes('timeout') || msg.includes('timed out'))
    return 'The server took too long to respond. Please try again.';

  // Auth
  if (msg.includes('invalid username or password'))
    return 'Incorrect username or password. Please try again.';
  if (msg.includes('username already taken'))
    return 'This username is already taken. Please choose a different one.';
  if (msg.includes('email already registered'))
    return 'This email is already registered. Try logging in instead.';
  if (msg.includes('authentication failed') || msg.includes('invalid or expired token'))
    return 'Your session has expired. Please log in again.';

  // Pending approval
  if (msg.includes('pending admin approval'))
    return 'Your account is pending admin approval. Please wait.';
  if (msg.includes('already pending'))
    return 'A registration request is already pending. Please wait for admin approval.';

  // Server errors
  if (msg.includes('500') || msg.includes('internal server error'))
    return 'Something went wrong on our end. Please try again later.';

  // If the message is already readable, return it
  if (raw.length < 100 && !msg.includes('traceback') && !msg.includes('error:'))
    return raw;

  return 'Something went wrong. Please try again.';
}

interface AuthProps {
  mode: 'login' | 'register';
}

const Auth: React.FC<AuthProps> = ({ mode }) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      showToast('Username is required', 'error');
      return;
    }
    if (!password) {
      showToast('Password is required', 'error');
      return;
    }

    if (mode === 'register') {
      if (!email.trim()) {
        showToast('Email is required', 'error');
        return;
      }
      if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
      }
      if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }
      if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await auth.login(username, password);
        navigate('/');
      } else {
        const res = await auth.register(username, email, password);
        if (res.success) {
          setPendingApproval(true);
        } else {
          showToast(friendlyError(res.error || ''), 'error');
        }
      }
    } catch (err: any) {
      showToast(friendlyError(err?.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Pending approval screen
  if (pendingApproval) {
    return (
      <div className="auth">
        <div className="auth__card">
          <div className="auth__logo">
            <img src="/web/icon-192.png" alt="Stopefy" className="auth__logo-icon" />
          </div>

          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <Clock size={48} style={{ color: '#F5E500', marginBottom: 12 }} />
          </div>

          <h1 className="auth__title">Pending Approval</h1>
          <p className="auth__subtitle">
            Your account has been submitted for review. An admin will approve your registration shortly.
          </p>

          <p className="auth__switch">
            <Link to="/login">Back to Login</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__logo">
          <img src="/web/icon-192.png" alt="Stopefy" className="auth__logo-icon" />
        </div>

        <h1 className="auth__title">
          {mode === 'login' ? 'Welcome back' : 'Create an account'}
        </h1>
        <p className="auth__subtitle">
          {mode === 'login'
            ? 'Sign in to continue listening'
            : 'Join Stopefy today'}
        </p>

        <form className="auth__form" onSubmit={handleSubmit}>
          <div className="auth__field">
            <label className="auth__label">Username</label>
            <input
              className="auth__input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>

          {mode === 'register' && (
            <div className="auth__field">
              <label className="auth__label">Email</label>
              <input
                className="auth__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
          )}

          <div className="auth__field">
            <label className="auth__label">Password</label>
            <div className="auth__input-wrapper">
              <input
                className="auth__input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="auth__toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div className="auth__field">
              <label className="auth__label">Confirm Password</label>
              <div className="auth__input-wrapper">
                <input
                  className="auth__input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                />
                <button
                  type="button"
                  className="auth__toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            className={`auth__submit${loading ? ' auth__submit--loading' : ''}`}
            disabled={loading}
          >
            {loading
              ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
              : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p className="auth__switch">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <Link to="/register">Register</Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link to="/login">Login</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default Auth;
