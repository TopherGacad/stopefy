import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { Eye, EyeOff } from 'lucide-react';

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

  // OTP
  if (msg.includes('invalid verification code'))
    return 'The code you entered is incorrect. Please check and try again.';
  if (msg.includes('expired'))
    return 'Your verification code has expired. Please register again to get a new code.';
  if (msg.includes('no pending registration'))
    return 'No verification in progress. Please register again.';

  // Email
  if (msg.includes('failed to send verification email') || msg.includes('failed to send'))
    return 'We couldn\'t send the verification email. Please try again in a moment.';

  // Server errors
  if (msg.includes('500') || msg.includes('internal server error'))
    return 'Something went wrong on our end. Please try again later.';

  // If the message is already readable (no weird codes/stack traces), return it
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

  // OTP state
  const [otpStep, setOtpStep] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || '';
    }
    setOtp(newOtp);
    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
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
        if (res.success && res.email) {
          setPendingEmail(res.email);
          setOtpStep(true);
          showToast('Verification code sent to your email', 'success');
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');

    if (code.length !== 6) {
      showToast('Please enter the 6-digit code', 'error');
      return;
    }

    setLoading(true);
    try {
      await auth.verifyOTP(pendingEmail, code);
      showToast('Account created successfully!', 'success');
      navigate('/');
    } catch (err: any) {
      showToast(friendlyError(err?.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // OTP verification screen
  if (otpStep) {
    return (
      <div className="auth">
        <div className="auth__card">
          <div className="auth__logo">
            <img src="/web/icon-192.png" alt="Stopefy" className="auth__logo-icon" />
          </div>

          <h1 className="auth__title">Verify your email</h1>
          <p className="auth__subtitle">
            We sent a 6-digit code to <strong>{pendingEmail}</strong>
          </p>

          <form className="auth__form" onSubmit={handleVerifyOtp}>
            <div className="auth__otp-container">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  className="auth__otp-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button
              type="submit"
              className={`auth__submit${loading ? ' auth__submit--loading' : ''}`}
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>
          </form>

          <p className="auth__switch">
            Didn&apos;t receive the code?{' '}
            <button
              type="button"
              className="auth__resend"
              onClick={() => {
                setOtpStep(false);
                setOtp(['', '', '', '', '', '']);
              }}
            >
              Go back
            </button>
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
