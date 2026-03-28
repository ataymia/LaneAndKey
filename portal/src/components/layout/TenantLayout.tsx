import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { TenantSidebar } from './TenantSidebar';
import { MobileNav } from './MobileNav';
import { getOnboardingStatus } from '../../lib/api/portalApi';
import { isDemoMode } from '../../contexts/AuthContext';
import './DashboardLayout.css';

export function TenantLayout() {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [onboardingRequired, setOnboardingRequired] = useState(false);

  useEffect(() => {
    // In demo mode there is no backend API — skip the onboarding check
    if (isDemoMode) {
      setOnboardingRequired(false);
      setChecking(false);
      return;
    }

    let cancelled = false;
    const checkOnboarding = async () => {
      try {
        setChecking(true);
        const data = await getOnboardingStatus();
        if (!cancelled) setOnboardingRequired(!!data.onboardingRequired);
      } catch {
        if (!cancelled) setOnboardingRequired(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    checkOnboarding();

    // Safety timeout — never keep the user on "Loading…" forever
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setOnboardingRequired(false);
        setChecking(false);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
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
