import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { MobileNav } from './MobileNav';
import './DashboardLayout.css';

export function AdminLayout() {
  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <main className="dashboard-main">
        <Outlet />
      </main>
      <MobileNav role="admin" />
    </div>
  );
}
