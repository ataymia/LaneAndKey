import { useEffect, useState } from 'react';
import {
  Building2,
  Users,
  FileText,
  DollarSign,
  Wrench,
  Calendar,
  Plus,
  UserPlus,
  Receipt,
  AlertCircle,
  ArrowRight,
  Home,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { propertyService, applicationService, maintenanceService, leaseService, activityLogService } from '../../lib/firebase';
import { rentStatementService } from '../../lib/firebase/rentStatements';
import type { Application, MaintenanceTicket, ActivityLog } from '../../types';
import './AdminDashboard.css';

interface DashboardStats {
  totalProperties: number;
  vacantProperties: number;
  upcomingRenewals: number;
  overdueRent: number;
  openTickets: number;
  newApplications: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    vacantProperties: 0,
    upcomingRenewals: 0,
    overdueRent: 0,
    openTickets: 0,
    newApplications: 0,
  });
  const [recentApplications, setRecentApplications] = useState<Application[]>([]);
  const [recentTickets, setRecentTickets] = useState<MaintenanceTicket[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Fetch all data in parallel
      const [properties, applications, allTickets, leases, allStatements, activityLogs] = await Promise.all([
        propertyService.getAll(),
        applicationService.getByStatus('new'),
        maintenanceService.getAll(),
        leaseService.getActive(),
        rentStatementService.getAll(),
        activityLogService.getRecent(10),
      ]);

      // Calculate stats
      const vacantCount = properties.filter(p => p.occupancyStatus === 'vacant').length;
      
      // Calculate upcoming renewals (within 60 days)
      const today = new Date();
      const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
      const renewals = leases.filter(lease => {
        if (!lease.endDate) return false;
        const endDate = new Date(lease.endDate);
        return endDate >= today && endDate <= sixtyDaysFromNow;
      }).length;

      // Count open tickets from the already fetched data
      const openTicketCount = allTickets.filter(t => 
        t.status === 'new' || t.status === 'in_progress' || t.status === 'waiting'
      ).length;
      
      // Get new tickets for the recent activity list
      const newTickets = allTickets.filter(t => t.status === 'new');

      // Compute overdue payments from open rent statements past due date
      const todayStr = today.toISOString().slice(0, 10);
      const overdueCount = allStatements.filter(s =>
        s.status === 'open' && s.balanceCents > 0 && s.dueDate < todayStr
      ).length;

      setStats({
        totalProperties: properties.length,
        vacantProperties: vacantCount,
        upcomingRenewals: renewals,
        overdueRent: overdueCount,
        openTickets: openTicketCount,
        newApplications: applications.length,
      });

      setRecentApplications(applications.slice(0, 5));
      setRecentTickets(newTickets.slice(0, 5));
      setRecentActivity(activityLogs);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      icon: <Building2 size={24} />,
      label: 'Total Properties',
      value: stats.totalProperties,
      color: 'primary',
      link: '/admin/properties',
    },
    {
      icon: <Home size={24} />,
      label: 'Vacant Units',
      value: stats.vacantProperties,
      color: 'warning',
      link: '/admin/properties?status=vacant',
    },
    {
      icon: <Calendar size={24} />,
      label: 'Upcoming Renewals',
      value: stats.upcomingRenewals,
      color: 'info',
      link: '/admin/leases?filter=expiring',
    },
    {
      icon: <DollarSign size={24} />,
      label: 'Overdue Payments',
      value: stats.overdueRent,
      color: 'error',
      link: '/admin/payments?status=overdue',
    },
    {
      icon: <Wrench size={24} />,
      label: 'Open Tickets',
      value: stats.openTickets,
      color: 'warning',
      link: '/admin/maintenance',
    },
    {
      icon: <FileText size={24} />,
      label: 'New Applications',
      value: stats.newApplications,
      color: 'success',
      link: '/admin/applications',
    },
  ];

  const quickActions = [
    {
      icon: <Plus size={20} />,
      label: 'Add Property',
      link: '/admin/properties',
    },
    {
      icon: <UserPlus size={20} />,
      label: 'Create User',
      link: '/admin/users',
    },
    {
      icon: <FileText size={20} />,
      label: 'Applications',
      link: '/admin/applications',
    },
    {
      icon: <Receipt size={20} />,
      label: 'Statements',
      link: '/admin/statements',
    },
    {
      icon: <Wrench size={20} />,
      label: 'Maintenance',
      link: '/admin/maintenance',
    },
  ];

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="skeleton-stats">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton stat-card-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back! Here's an overview of your properties.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((stat) => (
          <Link to={stat.link} key={stat.label} className={`stat-card stat-${stat.color}`}>
            <div className={`stat-card-icon ${stat.color}`}>
              {stat.icon}
            </div>
            <div className="stat-card-content">
              <div className="stat-card-value">{stat.value}</div>
              <div className="stat-card-label">{stat.label}</div>
            </div>
            <ArrowRight size={16} className="stat-card-arrow" />
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <section className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions">
          {quickActions.map((action) => (
            <Link to={action.link} key={action.label} className="quick-action-btn">
              {action.icon}
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <div className="dashboard-grid">
        {/* Recent Applications */}
        <section className="dashboard-card">
          <div className="card-header">
            <h3>
              <FileText size={18} />
              Recent Applications
            </h3>
            <Link to="/admin/applications" className="card-link">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="card-body">
            {recentApplications.length > 0 ? (
              <ul className="activity-list">
                {recentApplications.map((app) => (
                  <li key={app.id} className="activity-item">
                    <div className="activity-icon">
                      <Users size={16} />
                    </div>
                    <div className="activity-content">
                      <p className="activity-title">Application #{app.id.slice(0, 8)}</p>
                      <p className="activity-meta">
                        Status: <span className={`badge badge-${getStatusColor(app.status)}`}>{app.status}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state-sm">
                <AlertCircle size={24} />
                <p>No new applications</p>
              </div>
            )}
          </div>
        </section>

        {/* Open Maintenance Tickets */}
        <section className="dashboard-card">
          <div className="card-header">
            <h3>
              <Wrench size={18} />
              Open Maintenance
            </h3>
            <Link to="/admin/maintenance" className="card-link">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="card-body">
            {recentTickets.length > 0 ? (
              <ul className="activity-list">
                {recentTickets.map((ticket) => (
                  <li key={ticket.id} className="activity-item">
                    <div className={`activity-icon priority-${ticket.priority}`}>
                      <Wrench size={16} />
                    </div>
                    <div className="activity-content">
                      <p className="activity-title">{ticket.description.slice(0, 50)}...</p>
                      <p className="activity-meta">
                        <span className={`badge badge-${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                        <span className="separator">•</span>
                        {ticket.category}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state-sm">
                <AlertCircle size={24} />
                <p>No open tickets</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Activity Log */}
      {recentActivity.length > 0 && (
        <section className="dashboard-card">
          <div className="card-header">
            <h3>
              <Calendar size={18} />
              Recent Activity
            </h3>
          </div>
          <div className="card-body">
            <ul className="activity-list">
              {recentActivity.map((log) => (
                <li key={log.id} className="activity-item">
                  <div className="activity-icon">
                    <FileText size={16} />
                  </div>
                  <div className="activity-content">
                    <p className="activity-title">{formatAction(log.action)}</p>
                    <p className="activity-meta">
                      {log.metadata && typeof log.metadata === 'object' && 'tenantName' in log.metadata
                        ? String(log.metadata.tenantName)
                        : log.targetId.slice(0, 8)}
                      <span className="separator">•</span>
                      {new Date(log.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'new': return 'info';
    case 'in_review': return 'warning';
    case 'approved': return 'success';
    case 'declined': return 'error';
    default: return 'gray';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'emergency': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'low': return 'gray';
    default: return 'gray';
  }
}

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    lease_assigned: 'Lease Assigned',
    lease_ended: 'Lease Ended',
    lease_edited: 'Lease Edited',
    fee_added: 'Fee Added',
    credit_added: 'Credit Applied',
    payment_recorded: 'Payment Recorded',
    document_sent: 'Document Sent',
    document_signed: 'Document Signed',
    notice_sent: 'Notice Sent',
    application_approved: 'Application Approved',
    application_declined: 'Application Declined',
    property_created: 'Property Created',
    property_updated: 'Property Updated',
    maintenance_created: 'Maintenance Ticket Created',
    maintenance_updated: 'Maintenance Ticket Updated',
    user_role_changed: 'User Role Changed',
  };
  return labels[action] || action.replace(/_/g, ' ');
}
