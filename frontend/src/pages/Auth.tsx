import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Music, Eye, EyeOff } from 'lucide-react';

interface AuthProps {
  mode: 'login' | 'register';
}

const Auth: React.FC<AuthProps> = ({ mode }) => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    if (mode === 'register') {
      if (!email.trim()) {
        setError('Email is required');
        return;
      }
      if (!validateEmail(email)) {
        setError('Please enter a valid email address');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await auth.login(username, password);
      } else {
        await auth.register(username, email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err?.message || `${mode === 'login' ? 'Login' : 'Registration'} failed. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1A1A1A 0%, #242424 40%, #1A1A1A 70%, #242424 100%)',
        backgroundSize: '400% 400%',
        animation: 'authGradientShift 15s ease infinite',
        padding: '1rem',
      }}
    >
      <style>{`
        @keyframes authGradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      <div
        className="auth__card"
        style={{
          background: 'rgba(36, 36, 36, 0.95)',
          backdropFilter: 'blur(16px)',
          borderRadius: '1.25rem',
          padding: '2.5rem 2rem',
          width: '100%',
          maxWidth: '420px',
          border: '1px solid rgba(245, 229, 0, 0.15)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Music size={28} style={{ color: '#F5E500' }} />
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              Stopefy
            </span>
          </div>
        </div>

        {/* Title */}
        <h1
          className="auth__title"
          style={{
            color: '#FFFFFF',
            fontSize: '1.5rem',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: '1.75rem',
          }}
        >
          {mode === 'login' ? 'Welcome back' : 'Create an account'}
        </h1>

        {/* Error */}
        {error && (
          <div
            className="auth__error"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              color: '#ef4444',
              fontSize: '0.9rem',
              marginBottom: '1.25rem',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'block',
                color: '#6B6B6B',
                fontSize: '0.85rem',
                marginBottom: '0.4rem',
                fontWeight: 500,
              }}
            >
              Username
            </label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: '#2E2E2E',
                border: '1px solid #363636',
                borderRadius: '0.5rem',
                color: '#FFFFFF',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#F5E500'; }}
              onBlur={(e) => { e.target.style.borderColor = '#363636'; }}
            />
          </div>

          {/* Email (register only) */}
          {mode === 'register' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                style={{
                  display: 'block',
                  color: '#6B6B6B',
                  fontSize: '0.85rem',
                  marginBottom: '0.4rem',
                  fontWeight: 500,
                }}
              >
                Email
              </label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: '#2E2E2E',
                  border: '1px solid #363636',
                  borderRadius: '0.5rem',
                  color: '#FFFFFF',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#F5E500'; }}
                onBlur={(e) => { e.target.style.borderColor = '#363636'; }}
              />
            </div>
          )}

          {/* Password */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'block',
                color: '#6B6B6B',
                fontSize: '0.85rem',
                marginBottom: '0.4rem',
                fontWeight: 500,
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 2.75rem 0.75rem 1rem',
                  background: '#2E2E2E',
                  border: '1px solid #363636',
                  borderRadius: '0.5rem',
                  color: '#FFFFFF',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#F5E500'; }}
                onBlur={(e) => { e.target.style.borderColor = '#363636'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#6B6B6B',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (register only) */}
          {mode === 'register' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                style={{
                  display: 'block',
                  color: '#6B6B6B',
                  fontSize: '0.85rem',
                  marginBottom: '0.4rem',
                  fontWeight: 500,
                }}
              >
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.75rem 0.75rem 1rem',
                    background: '#2E2E2E',
                    border: '1px solid #363636',
                    borderRadius: '0.5rem',
                    color: '#FFFFFF',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#F5E500'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#363636'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#6B6B6B',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    display: 'flex',
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.85rem',
              background: loading
                ? '#363636'
                : 'linear-gradient(135deg, #F5E500, #d4c400)',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#1A1A1A',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
              marginTop: '0.5rem',
            }}
          >
            {loading
              ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
              : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {/* Toggle Link */}
        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#6B6B6B', fontSize: '0.9rem' }}>
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <Link to="/register" style={{ color: '#F5E500', textDecoration: 'none', fontWeight: 600 }}>
                Register
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#F5E500', textDecoration: 'none', fontWeight: 600 }}>
                Login
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default Auth;
