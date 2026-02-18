import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
import {
  Home,
  CreditCard,
  FileText,
  Wrench,
  MessageSquare,
  Bell,
  Settings,
  FolderOpen,
  LogOut,
  History,
} from 'lucide-react';
import './Sidebar.css';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

const tenantNavItems: NavItem[] = [
  { icon: <Home size={20} />, label: 'Dashboard', path: '/tenant' },
  { icon: <FileText size={20} />, label: 'My Lease', path: '/tenant/lease' },
  { icon: <CreditCard size={20} />, label: 'Payments', path: '/tenant/payments' },
  { icon: <History size={20} />, label: 'Rent History', path: '/tenant/rent-history' },
  { icon: <Wrench size={20} />, label: 'Maintenance', path: '/tenant/maintenance' },
  { icon: <FolderOpen size={20} />, label: 'Documents', path: '/tenant/documents' },
  { icon: <MessageSquare size={20} />, label: 'Messages', path: '/tenant/messages' },
  { icon: <Bell size={20} />, label: 'Alerts', path: '/tenant/alerts' },
  { icon: <Settings size={20} />, label: 'Settings', path: '/tenant/settings' },
];

export function TenantSidebar() {
  const { userProfile, logOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logOut();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">L&K</div>
          <span className="logo-text">Lane & Key</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {tenantNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/tenant'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="nav-badge">{item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="avatar">
            {userProfile?.displayName?.charAt(0) || 'T'}
          </div>
          <div className="user-details">
            <span className="user-name">{userProfile?.displayName || 'Tenant'}</span>
            <span className="user-role">Tenant</span>
          </div>
        </div>
        
        <div className="sidebar-actions">
          <button onClick={handleLogout} className="sidebar-action-btn logout-btn">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
