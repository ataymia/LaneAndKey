import { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Home,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Phone,
  Mail,
  Briefcase,
  DollarSign,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { applicationService, propertyService, userService } from '../../lib/firebase';
import { approveApplication } from '../../lib/api/portalApi';
import type { Application, Property, UserProfile } from '../../types';
import './Applications.css';

export function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [propertyMap, setPropertyMap] = useState<Record<string, Property>>({});
  const [userMap, setUserMap] = useState<Record<string, UserProfile>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { loadApplications(); }, []);

  const loadApplications = async () => {
    try {
      const data = await applicationService.getAll();
      setApplications(data);
      // Load property and user details
      const propIds = [...new Set(data.map(a => a.propertyId))];
      const userIds = [...new Set(data.map(a => a.primaryApplicantId))];
      const [props, users] = await Promise.all([
        Promise.all(propIds.map(async id => { try { return await propertyService.get(id); } catch { return null; } })),
        Promise.all(userIds.map(async id => { try { return await userService.get(id); } catch { return null; } })),
      ]);
      const pm: Record<string, Property> = {};
      props.forEach(p => { if (p) pm[p.id] = p; });
      setPropertyMap(pm);
      const um: Record<string, UserProfile> = {};
      users.forEach(u => { if (u) um[u.uid] = u; });
      setUserMap(um);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (app: Application) => {
    if (!confirm(`Approve application #${app.id.slice(0, 8)}?`)) return;
    setActionLoading(app.id);
    try {
      const result = await approveApplication(app.id);
      if (!result.success) {
        throw new Error('Approval endpoint failed');
      }

      const newTimeline = [...(app.timeline || []), {
        id: Date.now().toString(),
        event: 'approved',
        description: `Application approved by admin and linked to lease ${result.leaseId}`,
        date: new Date(),
        userId: 'admin',
      }];

      // Verify
      const updated = await applicationService.get(app.id);
      if (updated && updated.status === 'approved') {
        setApplications(prev => prev.map(a => a.id === app.id ? {
          ...a,
          status: 'approved',
          approvedAt: new Date(),
          timeline: newTimeline,
          leaseId: result.leaseId,
        } : a));
      } else {
        await loadApplications();
      }
    } catch (error) {
      console.error('Error approving application:', error);
      alert('Failed to approve application.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (app: Application) => {
    if (!confirm(`Decline application #${app.id.slice(0, 8)}?`)) return;
    setActionLoading(app.id);
    try {
      const newTimeline = [...(app.timeline || []), {
        id: Date.now().toString(),
        event: 'declined',
        description: 'Application declined by admin',
        date: new Date(),
        userId: 'admin',
      }];
      await applicationService.update(app.id, {
        status: 'declined',
        deniedAt: new Date(),
        timeline: newTimeline,
      } as any);
      const updated = await applicationService.get(app.id);
      if (updated && updated.status === 'declined') {
        setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'declined', deniedAt: new Date(), timeline: newTimeline } : a));
      } else {
        alert('Failed to decline. Firestore write may have been rejected.');
      }
    } catch (error) {
      console.error('Error declining application:', error);
      alert('Failed to decline application.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkInReview = async (app: Application) => {
    setActionLoading(app.id);
    try {
      const newTimeline = [...(app.timeline || []), {
        id: Date.now().toString(),
        event: 'in_review',
        description: 'Application marked as in review by admin',
        date: new Date(),
        userId: 'admin',
      }];
      await applicationService.update(app.id, {
        status: 'in_review',
        timeline: newTimeline,
      } as any);
      setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'in_review', timeline: newTimeline } : a));
    } catch (error) {
      console.error('Error updating application:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new': return <span className="badge badge-info"><Clock size={12} /> New</span>;
      case 'in_review': return <span className="badge badge-warning"><Clock size={12} /> In Review</span>;
      case 'approved': return <span className="badge badge-success"><CheckCircle size={12} /> Approved</span>;
      case 'declined': return <span className="badge badge-error"><XCircle size={12} /> Declined</span>;
      case 'withdrawn': return <span className="badge badge-gray"><XCircle size={12} /> Withdrawn</span>;
      case 'archived': return <span className="badge badge-gray">{status}</span>;
      default: return <span className="badge badge-gray">{status}</span>;
    }
  };

  const getPropertyAddress = (propId: string) => {
    const p = propertyMap[propId];
    return p ? `${p.address}, ${p.city}` : `Property ${propId.slice(0, 8)}`;
  };

  const getApplicantName = (uid: string, app: Application) => {
    const snap = (app as any).applicantSnapshot;
    if (snap?.fullName) return snap.fullName;
    const u = userMap[uid];
    return u?.displayName || u?.email || `User ${uid.slice(0, 8)}`;
  };

  const filteredApplications = applications
    .filter(app => statusFilter === 'all' || app.status === statusFilter)
    .filter(app => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const address = getPropertyAddress(app.propertyId).toLowerCase();
      const name = getApplicantName(app.primaryApplicantId, app).toLowerCase();
      return address.includes(q) || name.includes(q) || app.id.toLowerCase().includes(q);
    });

  const statusCounts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="applications-page">
        <div className="page-header"><h1>Applications</h1></div>
        <div className="loading-skeleton">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 16 }} />)}
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
          <input type="text" placeholder="Search by name, property..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="filter-tabs">
          {['all', 'new', 'in_review', 'approved', 'declined', 'withdrawn'].map(status => (
            <button
              key={status}
              className={`filter-tab ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? `All (${applications.length})` : `${status.replace('_', ' ')} (${statusCounts[status] || 0})`}
            </button>
          ))}
        </div>
      </div>

      {filteredApplications.length > 0 ? (
        <div className="applications-list">
          {filteredApplications.map(app => {
            const snap = (app as any).applicantSnapshot;
            const isExpanded = expandedApp === app.id;
            const isLoading = actionLoading === app.id;
            return (
              <div key={app.id} className="application-card">
                <div className="application-main">
                  <div className="application-info">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <User size={16} /> {getApplicantName(app.primaryApplicantId, app)}
                    </h3>
                    <div className="application-meta">
                      <span><Home size={14} /> {getPropertyAddress(app.propertyId)}</span>
                      <span><Calendar size={14} /> {new Date(app.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {getStatusBadge(app.status)}
                </div>
                <div className="application-actions">
                  <button className="btn btn-sm btn-outline" onClick={() => setExpandedApp(isExpanded ? null : app.id)}>
                    {isExpanded ? <><ChevronUp size={14} /> Hide Details</> : <><Eye size={14} /> View Details</>}
                  </button>
                  {app.status === 'new' && (
                    <button className="btn btn-sm btn-outline" onClick={() => handleMarkInReview(app)} disabled={isLoading}>
                      <Clock size={14} /> Mark In Review
                    </button>
                  )}
                  {(app.status === 'new' || app.status === 'in_review') && (
                    <>
                      <button className="btn btn-sm btn-success" onClick={() => handleApprove(app)} disabled={isLoading}>
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDecline(app)} disabled={isLoading}>
                        <XCircle size={14} /> Decline
                      </button>
                    </>
                  )}
                </div>
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 0 0', marginTop: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      {snap ? (
                        <>
                          <div style={{ fontSize: '0.875rem' }}>
                            <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}><Phone size={13} style={{ verticalAlign: '-2px' }} /> Phone</div>
                            <div style={{ fontWeight: 500 }}>{snap.phone || '—'}</div>
                          </div>
                          <div style={{ fontSize: '0.875rem' }}>
                            <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}><Calendar size={13} style={{ verticalAlign: '-2px' }} /> Date of Birth</div>
                            <div style={{ fontWeight: 500 }}>{snap.dateOfBirth || '—'}</div>
                          </div>
                          <div style={{ fontSize: '0.875rem' }}>
                            <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}><Briefcase size={13} style={{ verticalAlign: '-2px' }} /> Employer</div>
                            <div style={{ fontWeight: 500 }}>{snap.employer || '—'}</div>
                          </div>
                          <div style={{ fontSize: '0.875rem' }}>
                            <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}><DollarSign size={13} style={{ verticalAlign: '-2px' }} /> Monthly Income</div>
                            <div style={{ fontWeight: 500 }}>{snap.monthlyIncome ? `$${snap.monthlyIncome.toLocaleString()}` : '—'}</div>
                          </div>
                          <div style={{ fontSize: '0.875rem' }}>
                            <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}><Home size={13} style={{ verticalAlign: '-2px' }} /> Current Address</div>
                            <div style={{ fontWeight: 500 }}>{snap.currentAddress || '—'}</div>
                          </div>
                          <div style={{ fontSize: '0.875rem' }}>
                            <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}><Calendar size={13} style={{ verticalAlign: '-2px' }} /> Desired Move-in</div>
                            <div style={{ fontWeight: 500 }}>{snap.moveInDate || '—'}</div>
                          </div>
                          {snap.additionalNotes && (
                            <div style={{ fontSize: '0.875rem', gridColumn: '1 / -1' }}>
                              <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Additional Notes</div>
                              <div style={{ fontWeight: 500 }}>{snap.additionalNotes}</div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: '0.875rem', color: '#9ca3af', gridColumn: '1 / -1' }}>
                          No applicant details available (submitted before profile collection was enabled).
                          {userMap[app.primaryApplicantId] && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <Mail size={13} style={{ verticalAlign: '-2px' }} /> {userMap[app.primaryApplicantId].email}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Timeline */}
                    {app.timeline && app.timeline.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.5rem' }}>Timeline</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {app.timeline.map((ev, i) => (
                            <div key={i} style={{ fontSize: '0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span style={{ color: '#9ca3af' }}>{new Date(ev.date).toLocaleDateString()}</span>
                              <span style={{ fontWeight: 500 }}>{ev.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Timestamps */}
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#9ca3af' }}>
                      <span>Created: {new Date(app.createdAt).toLocaleString()}</span>
                      {(app as any).submittedAt && <span>Submitted: {new Date((app as any).submittedAt).toLocaleString()}</span>}
                      {(app as any).approvedAt && <span>Approved: {new Date((app as any).approvedAt).toLocaleString()}</span>}
                      {(app as any).deniedAt && <span>Denied: {new Date((app as any).deniedAt).toLocaleString()}</span>}
                      {(app as any).withdrawnAt && <span>Withdrawn: {new Date((app as any).withdrawnAt).toLocaleString()}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><FileText size={32} /></div>
          <h3 className="empty-state-title">No applications</h3>
          <p className="empty-state-description">
            {statusFilter !== 'all' ? 'No applications match this filter' : 'Applications will appear here when applicants apply'}
          </p>
        </div>
      )}
    </div>
  );
}
