import { NavLink } from 'react-router-dom';
import {
  Home,
  CreditCard,
  FileText,
  MessageSquare,
  Bell,
  Settings,
} from 'lucide-react';
import './MobileNav.css';

interface MobileNavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

const tenantMobileNavItems: MobileNavItem[] = [
  { icon: <Home size={20} />, label: 'Home', path: '/tenant' },
  { icon: <CreditCard size={20} />, label: 'Payments', path: '/tenant/payments' },
  { icon: <MessageSquare size={20} />, label: 'Messages', path: '/tenant/messages' },
  { icon: <Bell size={20} />, label: 'Alerts', path: '/tenant/alerts' },
  { icon: <Settings size={20} />, label: 'Settings', path: '/tenant/settings' },
];

const applicantMobileNavItems: MobileNavItem[] = [
  { icon: <Home size={20} />, label: 'Home', path: '/applicant' },
  { icon: <FileText size={20} />, label: 'Applications', path: '/applicant/applications' },
  { icon: <MessageSquare size={20} />, label: 'Messages', path: '/applicant/messages' },
  { icon: <Bell size={20} />, label: 'Alerts', path: '/applicant/alerts' },
  { icon: <Settings size={20} />, label: 'Settings', path: '/applicant/settings' },
];

const adminMobileNavItems: MobileNavItem[] = [
  { icon: <Home size={20} />, label: 'Dashboard', path: '/admin' },
  { icon: <FileText size={20} />, label: 'Properties', path: '/admin/properties' },
  { icon: <MessageSquare size={20} />, label: 'Messages', path: '/admin/messages' },
  { icon: <Bell size={20} />, label: 'Alerts', path: '/admin/alerts' },
  { icon: <Settings size={20} />, label: 'Settings', path: '/admin/settings' },
];

interface MobileNavProps {
  role: 'admin' | 'tenant' | 'applicant';
}

export function MobileNav({ role }: MobileNavProps) {
  const getNavItems = () => {
    switch (role) {
      case 'admin':
        return adminMobileNavItems;
      case 'tenant':
        return tenantMobileNavItems;
      case 'applicant':
        return applicantMobileNavItems;
      default:
        return tenantMobileNavItems;
    }
  };

  const navItems = getNavItems();

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-items">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin' || item.path === '/tenant' || item.path === '/applicant'}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span className="mobile-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
