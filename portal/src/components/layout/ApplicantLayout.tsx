import { Outlet } from 'react-router-dom';
import { ApplicantSidebar } from './ApplicantSidebar';
import { MobileNav } from './MobileNav';
import './DashboardLayout.css';

export function ApplicantLayout() {
  return (
    <div className="dashboard-layout">
      <ApplicantSidebar />
      <main className="dashboard-main">
        <Outlet />
      </main>
      <MobileNav role="applicant" />
    </div>
  );
}
