import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
import {
  Home,
  CreditCard,
  FileText,
  MessageSquare,
  Bell,
  Settings,
  Search,
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  DollarSign,
  Receipt,
  Wrench,
  FolderOpen,
  LogOut,
  X,
  Menu,
  ClipboardList,
  Stamp,
  FilePlus,
  History,
  ClipboardCheck,
  ExternalLink,
} from 'lucide-react';
import './MobileNav.css';

interface MobileNavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

// Bottom bar items (4 + More)
const tenantBottomItems: MobileNavItem[] = [
  { icon: <Home size={20} />, label: 'Home', path: '/tenant' },
  { icon: <CreditCard size={20} />, label: 'Payments', path: '/tenant/payments' },
  { icon: <MessageSquare size={20} />, label: 'Messages', path: '/tenant/messages' },
  { icon: <Bell size={20} />, label: 'Alerts', path: '/tenant/alerts' },
];

const applicantBottomItems: MobileNavItem[] = [
  { icon: <Home size={20} />, label: 'Home', path: '/applicant' },
  { icon: <Search size={20} />, label: 'Listings', path: '/applicant/listings' },
  { icon: <FileText size={20} />, label: 'Apps', path: '/applicant/applications' },
  { icon: <MessageSquare size={20} />, label: 'Messages', path: '/applicant/messages' },
];

const adminBottomItems: MobileNavItem[] = [
  { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/admin' },
  { icon: <Building2 size={20} />, label: 'Properties', path: '/admin/properties' },
  { icon: <MessageSquare size={20} />, label: 'Messages', path: '/admin/messages' },
  { icon: <Bell size={20} />, label: 'Alerts', path: '/admin/alerts' },
];

// Full menu items (all pages)
const tenantFullItems: MobileNavItem[] = [
  { icon: <Home size={20} />, label: 'Dashboard', path: '/tenant' },
  { icon: <FileText size={20} />, label: 'My Lease', path: '/tenant/lease' },
  { icon: <CreditCard size={20} />, label: 'Payments', path: '/tenant/payments' },
  { icon: <History size={20} />, label: 'Rent History', path: '/tenant/rent-history' },
  { icon: <Wrench size={20} />, label: 'Maintenance', path: '/tenant/maintenance' },
  { icon: <ClipboardCheck size={20} />, label: 'Inspection', path: '/tenant/inspection' },
  { icon: <FolderOpen size={20} />, label: 'Documents', path: '/tenant/documents' },
  { icon: <MessageSquare size={20} />, label: 'Messages', path: '/tenant/messages' },
  { icon: <Bell size={20} />, label: 'Alerts', path: '/tenant/alerts' },
  { icon: <Settings size={20} />, label: 'Settings', path: '/tenant/settings' },
];

const applicantFullItems: MobileNavItem[] = [
  { icon: <Home size={20} />, label: 'Dashboard', path: '/applicant' },
  { icon: <Search size={20} />, label: 'Browse Listings', path: '/applicant/listings' },
  { icon: <FileText size={20} />, label: 'My Applications', path: '/applicant/applications' },
  { icon: <FolderOpen size={20} />, label: 'Documents', path: '/applicant/documents' },
  { icon: <MessageSquare size={20} />, label: 'Messages', path: '/applicant/messages' },
  { icon: <Bell size={20} />, label: 'Alerts', path: '/applicant/alerts' },
  { icon: <Settings size={20} />, label: 'Settings', path: '/applicant/settings' },
];

const adminFullItems: MobileNavItem[] = [
  { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/admin' },
  { icon: <Building2 size={20} />, label: 'Properties', path: '/admin/properties' },
  { icon: <Users size={20} />, label: 'Tenants', path: '/admin/tenants' },
  { icon: <FileText size={20} />, label: 'Applications', path: '/admin/applications' },
  { icon: <DollarSign size={20} />, label: 'Payments', path: '/admin/payments' },
  { icon: <Receipt size={20} />, label: 'Invoices', path: '/admin/invoices' },
  { icon: <ClipboardList size={20} />, label: 'Statements', path: '/admin/statements' },
  { icon: <Wrench size={20} />, label: 'Maintenance', path: '/admin/maintenance' },
  { icon: <MessageSquare size={20} />, label: 'Messages', path: '/admin/messages' },
  { icon: <Bell size={20} />, label: 'Alerts', path: '/admin/alerts' },
  { icon: <FolderOpen size={20} />, label: 'Documents', path: '/admin/documents' },
  { icon: <Stamp size={20} />, label: 'Lease Templates', path: '/admin/lease-templates' },
  { icon: <FilePlus size={20} />, label: 'Generate Lease', path: '/admin/generate-lease' },
  { icon: <UserCog size={20} />, label: 'Users', path: '/admin/users' },
  { icon: <Settings size={20} />, label: 'Settings', path: '/admin/settings' },
];

interface MobileNavProps {
  role: 'admin' | 'tenant' | 'applicant';
}

export function MobileNav({ role }: MobileNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { userProfile, logOut } = useAuth();
  const navigate = useNavigate();

  const getBottomItems = () => {
    switch (role) {
      case 'admin': return adminBottomItems;
      case 'tenant': return tenantBottomItems;
      case 'applicant': return applicantBottomItems;
    }
  };

  const getFullItems = () => {
    switch (role) {
      case 'admin': return adminFullItems;
      case 'tenant': return tenantFullItems;
      case 'applicant': return applicantFullItems;
    }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logOut();
    navigate('/login');
  };

  const handleMenuNavClick = () => {
    setMenuOpen(false);
  };

  const bottomItems = getBottomItems();
  const fullItems = getFullItems();

  return (
    <>
      {/* Full-screen menu overlay */}
      {menuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-menu-header">
            <div className="mobile-menu-user">
              <div className="mobile-menu-avatar">
                {userProfile?.displayName?.charAt(0) || role.charAt(0).toUpperCase()}
              </div>
              <div className="mobile-menu-user-info">
                <span className="mobile-menu-user-name">{userProfile?.displayName || role}</span>
                <span className="mobile-menu-user-email">{userProfile?.email || ''}</span>
              </div>
            </div>
            <button className="mobile-menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <X size={24} />
            </button>
          </div>
          <nav className="mobile-menu-nav">
            {fullItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin' || item.path === '/tenant' || item.path === '/applicant'}
                className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                onClick={handleMenuNavClick}
              >
                <span className="mobile-menu-item-icon">{item.icon}</span>
                <span className="mobile-menu-item-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="mobile-menu-footer">
            {role === 'admin' && (
              <a href="/" target="_blank" rel="noopener noreferrer" className="mobile-menu-action" onClick={handleMenuNavClick}>
                <ExternalLink size={20} />
                <span>View Public Site</span>
              </a>
            )}
            <button className="mobile-menu-action mobile-menu-logout" onClick={handleLogout}>
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="mobile-nav">
        <div className="mobile-nav-items">
          {bottomItems.map((item) => (
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
          <button
            className={`mobile-nav-item mobile-nav-more ${menuOpen ? 'active' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span className="mobile-nav-icon"><Menu size={20} /></span>
            <span className="mobile-nav-label">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
