import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  FileText,
  DollarSign,
  Receipt,
  Wrench,
  MessageSquare,
  Bell,
  FolderOpen,
  Settings,
  LogOut,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Stamp,
  FilePlus,
} from 'lucide-react';
import { useState } from 'react';
import './Sidebar.css';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

const adminNavItems: NavItem[] = [
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

export function AdminSidebar() {
  const { userProfile, logOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logOut();
    navigate('/login');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">L&K</div>
          {!collapsed && <span className="logo-text">Lane & Key</span>}
        </div>
        <button 
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {adminNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
            {!collapsed && item.badge !== undefined && item.badge > 0 && (
              <span className="nav-badge">{item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="user-info">
            <div className="avatar">
              {userProfile?.displayName?.charAt(0) || 'A'}
            </div>
            <div className="user-details">
              <span className="user-name">{userProfile?.displayName || 'Admin'}</span>
              <span className="user-role">Administrator</span>
            </div>
          </div>
        )}
        
        <div className="sidebar-actions">
          <a 
            href="/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="sidebar-action-btn"
          >
            <ExternalLink size={18} />
            {!collapsed && <span>View Site</span>}
          </a>
          <button onClick={handleLogout} className="sidebar-action-btn logout-btn">
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
