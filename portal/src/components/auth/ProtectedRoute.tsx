import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
import type { UserRole } from '../../types';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, userProfile, loading, profileError, isDemoMode, refreshProfile, logOut } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <Loader2 className="loading-spinner" size={48} />
        <p>Loading...</p>
        <style>{`
          .loading-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            gap: 1rem;
            background: var(--gray-50, #f9fafb);
          }
          .loading-spinner {
            color: var(--primary-color, #2563eb);
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // In demo mode, check userProfile instead of user
  // In normal mode, check user (profile may be missing due to error)
  const isAuthenticated = isDemoMode ? !!userProfile : !!user;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated but profile failed to load — show retry UI
  if (!userProfile && (profileError || !isDemoMode)) {
    return (
      <div className="loading-screen">
        <AlertTriangle size={48} style={{ color: '#f59e0b' }} />
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Profile Incomplete</h2>
        <p style={{ color: '#6b7280', textAlign: 'center', maxWidth: 400 }}>
          {profileError || 'We could not load your profile. This may be a temporary issue.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => refreshProfile()}
            className="btn btn-primary"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem', borderRadius: '0.5rem',
              background: 'var(--primary-color, #2563eb)', color: 'white',
              border: 'none', cursor: 'pointer', fontSize: '0.875rem',
            }}
          >
            <RefreshCw size={16} />
            Retry
          </button>
          <button
            onClick={() => logOut()}
            className="btn btn-secondary"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem', borderRadius: '0.5rem',
              background: 'white', color: '#374151',
              border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '0.875rem',
            }}
          >
            Sign Out
          </button>
        </div>
        <style>{`
          .loading-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            gap: 1rem;
            background: var(--gray-50, #f9fafb);
          }
        `}</style>
      </div>
    );
  }

  if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) {
    // Redirect to appropriate dashboard based on role
    switch (userProfile.role) {
      case 'admin':
        return <Navigate to="/admin" replace />;
      case 'tenant':
        return <Navigate to="/tenant" replace />;
      case 'applicant':
        return <Navigate to="/applicant" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}
