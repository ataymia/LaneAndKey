import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
import { Eye, EyeOff, Loader2, LogIn, AlertCircle } from 'lucide-react';
import './Auth.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user, userProfile, isDemoMode } = useAuth();
  const navigate = useNavigate();

  // Redirect based on role after login (or to home if profile failed to load)
  useEffect(() => {
    if (userProfile) {
      switch (userProfile.role) {
        case 'admin':
          navigate('/admin', { replace: true });
          break;
        case 'tenant':
          navigate('/tenant', { replace: true });
          break;
        case 'applicant':
          navigate('/applicant', { replace: true });
          break;
      }
    } else if (user) {
      // Auth succeeded but profile failed — send to home so ProtectedRoute shows retry
      navigate('/', { replace: true });
    }
  }, [user, userProfile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      // Navigation will be handled by the useEffect above
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('auth/invalid-credential') || 
            err.message.includes('auth/wrong-password') ||
            err.message.includes('auth/user-not-found')) {
          setError('Invalid email or password');
        } else if (err.message.includes('auth/too-many-requests')) {
          setError('Too many attempts. Please try again later.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = (accountType: 'admin' | 'tenant' | 'applicant') => {
    const emails = {
      admin: 'admin@laneandkey.com',
      tenant: 'tenant@laneandkey.com',
      applicant: 'applicant@laneandkey.com',
    };
    setEmail(emails[accountType]);
    setPassword('Demo123!');
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="logo-icon">L&K</div>
          </div>
          <h1>Welcome Back</h1>
          <p>Sign in to your Lane & Key account</p>
        </div>

        {isDemoMode && (
          <div className="demo-mode-banner">
            <AlertCircle size={18} />
            <div>
              <strong>Demo Mode</strong>
              <p>Firebase not configured. Use demo accounts below:</p>
            </div>
          </div>
        )}

        {isDemoMode && (
          <div className="demo-accounts">
            <button 
              type="button" 
              className="demo-account-btn admin"
              onClick={() => fillDemoCredentials('admin')}
            >
              <span className="demo-role">Admin</span>
              <span className="demo-email">admin@laneandkey.com</span>
            </button>
            <button 
              type="button" 
              className="demo-account-btn tenant"
              onClick={() => fillDemoCredentials('tenant')}
            >
              <span className="demo-role">Tenant</span>
              <span className="demo-email">tenant@laneandkey.com</span>
            </button>
            <button 
              type="button" 
              className="demo-account-btn applicant"
              onClick={() => fillDemoCredentials('applicant')}
            >
              <span className="demo-role">Applicant</span>
              <span className="demo-email">applicant@laneandkey.com</span>
            </button>
            <p className="demo-password-hint">Password for all: <code>Demo123!</code></p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {!isDemoMode && (
            <div className="form-actions-auth">
              <Link to="/forgot-password" className="forgot-link">
                Forgot password?
              </Link>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Sign In
              </>
            )}
          </button>
        </form>

        {!isDemoMode && (
          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/signup">Create one</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
