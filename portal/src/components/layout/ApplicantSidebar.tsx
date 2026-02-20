import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
import {
  Home,
  FileText,
  FolderOpen,
  MessageSquare,
  Bell,
  Settings,
  LogOut,
  Search,
} from 'lucide-react';
import './Sidebar.css';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

const applicantNavItems: NavItem[] = [
  { icon: <Home size={20} />, label: 'Dashboard', path: '/applicant' },
  { icon: <Search size={20} />, label: 'Browse Listings', path: '/applicant/listings' },
  { icon: <FileText size={20} />, label: 'My Applications', path: '/applicant/applications' },
  { icon: <FolderOpen size={20} />, label: 'Documents', path: '/applicant/documents' },
  { icon: <MessageSquare size={20} />, label: 'Messages', path: '/applicant/messages' },
  { icon: <Bell size={20} />, label: 'Alerts', path: '/applicant/alerts' },
  { icon: <Settings size={20} />, label: 'Settings', path: '/applicant/settings' },
];

export function ApplicantSidebar() {
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
        {applicantNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/applicant'}
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
            {userProfile?.displayName?.charAt(0) || 'A'}
          </div>
          <div className="user-details">
            <span className="user-name">{userProfile?.displayName || 'Applicant'}</span>
            <span className="user-role">Applicant</span>
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
