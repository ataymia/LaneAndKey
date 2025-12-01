import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts';
import {
  Bell,
  Check,
  Archive,
  FileText,
  Users,
  Wrench,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { alertService } from '../../lib/firebase';
import type { Alert } from '../../types';
import './Alerts.css';

export function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (user) {
      loadAlerts();
    }
  }, [user]);

  const loadAlerts = async () => {
    if (!user) return;
    try {
      const data = await alertService.getByUser(user.uid);
      setAlerts(data);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      await alertService.markAsRead(alertId);
      setAlerts(prev => 
        prev.map(a => a.id === alertId ? { ...a, read: true } : a)
      );
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const archiveAlert = async (alertId: string) => {
    try {
      await alertService.archive(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (error) {
      console.error('Error archiving alert:', error);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'application': return <FileText size={18} />;
      case 'lead': return <Users size={18} />;
      case 'maintenance': return <Wrench size={18} />;
      case 'payment_received': return <DollarSign size={18} />;
      case 'payment_failed': return <DollarSign size={18} />;
      case 'lease_expiring': return <Calendar size={18} />;
      default: return <Bell size={18} />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'application': return 'info';
      case 'lead': return 'primary';
      case 'maintenance': return 'warning';
      case 'payment_received': return 'success';
      case 'payment_failed': return 'error';
      case 'lease_expiring': return 'warning';
      default: return 'gray';
    }
  };

  const filteredAlerts = filter === 'unread' 
    ? alerts.filter(a => !a.read) 
    : alerts;

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="alerts-page">
      <div className="page-header">
        <div>
          <h1>Alerts</h1>
          <p>{unreadCount} unread notifications</p>
        </div>
        {alerts.length > 0 && (
          <button 
            className="btn btn-secondary"
            onClick={() => alerts.filter(a => !a.read).forEach(a => markAsRead(a.id))}
          >
            <Check size={18} />
            Mark All Read
          </button>
        )}
      </div>

      <div className="alerts-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({alerts.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {loading ? (
        <div className="alerts-loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton alert-skeleton" />
          ))}
        </div>
      ) : filteredAlerts.length > 0 ? (
        <div className="alerts-list">
          {filteredAlerts.map(alert => (
            <div key={alert.id} className={`alert-item ${alert.read ? 'read' : ''}`}>
              <div className={`alert-icon ${getAlertColor(alert.type)}`}>
                {getAlertIcon(alert.type)}
              </div>
              <div className="alert-content">
                <h4 className="alert-title">{alert.title}</h4>
                <p className="alert-message">{alert.message}</p>
                <span className="alert-time">
                  {new Date(alert.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="alert-actions">
                {!alert.read && (
                  <button 
                    className="btn btn-icon btn-ghost"
                    onClick={() => markAsRead(alert.id)}
                    title="Mark as read"
                  >
                    <Check size={16} />
                  </button>
                )}
                <button 
                  className="btn btn-icon btn-ghost"
                  onClick={() => archiveAlert(alert.id)}
                  title="Archive"
                >
                  <Archive size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Bell size={32} />
          </div>
          <h3 className="empty-state-title">No alerts</h3>
          <p className="empty-state-description">
            {filter === 'unread' 
              ? 'All caught up! No unread notifications.'
              : 'Notifications will appear here when there are updates.'}
          </p>
        </div>
      )}
    </div>
  );
}
