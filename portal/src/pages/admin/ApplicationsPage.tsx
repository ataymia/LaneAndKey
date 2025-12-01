import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Search,
  Home,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react';
import { applicationService } from '../../lib/firebase';
import type { Application } from '../../types';
import './Applications.css';

export function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const data = await Promise.all([
        applicationService.getByStatus('new'),
        applicationService.getByStatus('in_review'),
        applicationService.getByStatus('approved'),
        applicationService.getByStatus('declined'),
      ]);
      setApplications(data.flat());
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredApplications = statusFilter === 'all' 
    ? applications 
    : applications.filter(app => app.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new': return <span className="badge badge-info">New</span>;
      case 'in_review': return <span className="badge badge-warning">In Review</span>;
      case 'approved': return <span className="badge badge-success">Approved</span>;
      case 'declined': return <span className="badge badge-error">Declined</span>;
      case 'withdrawn': return <span className="badge badge-gray">Withdrawn</span>;
      case 'archived': return <span className="badge badge-gray">Archived</span>;
      default: return <span className="badge badge-gray">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="applications-page">
        <div className="page-header">
          <h1>Applications</h1>
        </div>
        <div className="loading-skeleton">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 80, marginBottom: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="applications-page">
      <div className="page-header">
        <div>
          <h1>Applications</h1>
          <p>{applications.length} total applications</p>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search applications..." />
        </div>
        <div className="filter-tabs">
          {['all', 'new', 'in_review', 'approved', 'declined'].map(status => (
            <button
              key={status}
              className={`filter-tab ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {filteredApplications.length > 0 ? (
        <div className="applications-list">
          {filteredApplications.map(app => (
            <div key={app.id} className="application-card">
              <div className="application-main">
                <div className="application-info">
                  <h3>Application #{app.id.slice(0, 8)}</h3>
                  <div className="application-meta">
                    <span>
                      <Home size={14} />
                      Property ID: {app.propertyId.slice(0, 8)}
                    </span>
                    <span>
                      <Calendar size={14} />
                      {new Date(app.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {getStatusBadge(app.status)}
              </div>
              <div className="application-actions">
                <Link to={`/admin/applications/${app.id}`} className="btn btn-sm btn-outline">
                  <Eye size={14} />
                  View Details
                </Link>
                {app.status === 'new' && (
                  <>
                    <button className="btn btn-sm btn-success">
                      <CheckCircle size={14} />
                      Approve
                    </button>
                    <button className="btn btn-sm btn-danger">
                      <XCircle size={14} />
                      Decline
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileText size={32} />
          </div>
          <h3 className="empty-state-title">No applications</h3>
          <p className="empty-state-description">
            {statusFilter !== 'all' 
              ? 'No applications match this filter'
              : 'Applications will appear here when applicants apply'}
          </p>
        </div>
      )}
    </div>
  );
}
