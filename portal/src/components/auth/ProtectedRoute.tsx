import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
import type { UserRole } from '../../types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth();

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
            background: var(--gray-50);
          }
          .loading-spinner {
            color: var(--primary-color);
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!userProfile) {
    return (
      <div className="loading-screen">
        <Loader2 className="loading-spinner" size={48} />
        <p>Loading profile...</p>
        <style>{`
          .loading-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: var(--gray-50);
          }
          .loading-spinner {
            color: var(--primary-color);
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

  if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
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
