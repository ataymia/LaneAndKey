import { Outlet } from 'react-router-dom';
import { TenantSidebar } from './TenantSidebar';
import { MobileNav } from './MobileNav';
import './DashboardLayout.css';

export function TenantLayout() {
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
