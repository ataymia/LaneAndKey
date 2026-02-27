import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { TenantSidebar } from './TenantSidebar';
import { MobileNav } from './MobileNav';
import { getOnboardingStatus } from '../../lib/api/portalApi';
import './DashboardLayout.css';

export function TenantLayout() {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [onboardingRequired, setOnboardingRequired] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        setChecking(true);
        const data = await getOnboardingStatus();
        setOnboardingRequired(!!data.onboardingRequired);
      } catch {
        setOnboardingRequired(false);
      } finally {
        setChecking(false);
      }
    };

    checkOnboarding();
  }, [location.pathname]);

  if (checking) {
    return <div className="dashboard-layout"><main className="dashboard-main">Loading...</main></div>;
  }

  if (onboardingRequired && !location.pathname.endsWith('/tenant/onboarding')) {
    return <Navigate to="/tenant/onboarding" replace />;
  }

  if (!onboardingRequired && location.pathname.endsWith('/tenant/onboarding')) {
    return <Navigate to="/tenant" replace />;
  }

  return (
    <div className="dashboard-layout">
      <TenantSidebar />
      <main className="dashboard-main">
        <Outlet />
      </main>
      <MobileNav role="tenant" />
    </div>
  );
}
