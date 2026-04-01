import { useState, useEffect, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, query, orderBy, where, limit as fbLimit } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { adminCreateUser } from '../../lib/firebase/auth';
import { adminSendPasswordReset } from '../../lib/firebase/auth';
import { alertService } from '../../lib/firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import type { UserProfile, UserRole, Payment, MaintenanceTicket } from '../../types';
import {
  Search,
  UserPlus,
  Mail,
  Shield,
  Users,
  UserCheck,
  UserX,
  ChevronDown,
  ChevronUp,
  Send,
  Eye,
  RefreshCw,
  X,
  AlertTriangle,
  DollarSign,
  Wrench,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  KeyRound,
} from 'lucide-react';
import './Users.css';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UserActivity {
  recentPayments: (Payment & { id: string })[];
  maintenanceTickets: (MaintenanceTicket & { id: string })[];
  alertCount: number;
}

/* ------------------------------------------------------------------ */
/*  User Activity Panel (expanded table row)                          */
/* ------------------------------------------------------------------ */

function UserActivityPanel({
  activity,
  loading,
  formatCents,
  formatDate,
}: {
  activity?: UserActivity;
  loading: boolean;
  formatCents: (c: number) => string;
  formatDate: (d: Date) => string;
}) {
  if (loading) {
    return (
      <div className="activity-panel">
        <div className="spinner-sm" /> Loading activity…
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="activity-panel">
        <p className="muted">No activity data available.</p>
      </div>
    );
  }

  return (
    <div className="activity-panel">
      {/* Payments */}
      <div className="activity-section">
        <h4><DollarSign size={16} /> Recent Payments</h4>
        {activity.recentPayments.length === 0 ? (
          <p className="muted">No payments on record.</p>
        ) : (
          <table className="mini-table">
            <thead>
              <tr><th>Date</th><th>Amount</th><th>Type</th><th>Status</th></tr>
            </thead>
            <tbody>
              {activity.recentPayments.map(p => (
                <tr key={p.id}>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>{formatCents(p.amount)}</td>
                  <td className="capitalize">{p.type.replace('_', ' ')}</td>
                  <td>
                    <span className={`status-pill status-${p.status}`}>
                      {p.status === 'completed' && <CheckCircle2 size={12} />}
                      {p.status === 'pending' && <Clock size={12} />}
                      {p.status === 'failed' && <XCircle size={12} />}
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Maintenance */}
      <div className="activity-section">
        <h4><Wrench size={16} /> Maintenance Tickets</h4>
        {activity.maintenanceTickets.length === 0 ? (
          <p className="muted">No tickets on record.</p>
        ) : (
          <table className="mini-table">
            <thead>
              <tr><th>Date</th><th>Category</th><th>Priority</th><th>Status</th></tr>
            </thead>
            <tbody>
              {activity.maintenanceTickets.map(t => (
                <tr key={t.id}>
                  <td>{formatDate(t.createdAt)}</td>
                  <td className="capitalize">{t.category}</td>
                  <td><span className={`priority-pill priority-${t.priority}`}>{t.priority}</span></td>
                  <td className="capitalize">{t.status.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary */}
      <div className="activity-section">
        <h4><FileText size={16} /> Summary</h4>
        <div className="activity-summary">
          <div><strong>{activity.recentPayments.length}</strong> recent payment(s)</div>
          <div><strong>{activity.maintenanceTickets.length}</strong> maintenance ticket(s)</div>
          <div><strong>{activity.alertCount}</strong> active alert(s)</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function UsersPage() {
  const { userProfile } = useAuth();

  // Main state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');

  // Create-user modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    role: 'applicant' as UserRole,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Send-notice modal
  const [noticeTarget, setNoticeTarget] = useState<UserProfile | null>(null);
  const [noticeForm, setNoticeForm] = useState({ title: '', message: '' });
  const [sendingNotice, setSendingNotice] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Expanded user detail
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [activityData, setActivityData] = useState<Record<string, UserActivity>>({});
  const [activityLoading, setActivityLoading] = useState<string | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Data fetching                                                    */
  /* ---------------------------------------------------------------- */

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(usersQuery);
      const usersData = snapshot.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          uid: d.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as UserProfile;
      });
      setUsers(usersData);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Make sure you have admin permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const fetchUserActivity = async (uid: string) => {
    if (activityData[uid]) return;
    setActivityLoading(uid);
    try {
      const paymentsQ = query(
        collection(db, 'payments'),
        where('tenantUid', '==', uid),
        orderBy('createdAt', 'desc'),
        fbLimit(5)
      );
      const paymentsSnap = await getDocs(paymentsQ);
      const recentPayments = paymentsSnap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          dueDate: data.dueDate?.toDate?.() || new Date(),
          paidDate: data.paidDate?.toDate?.() || null,
        } as Payment & { id: string };
      });

      const ticketsQ = query(
        collection(db, 'maintenance'),
        where('tenantId', '==', uid),
        orderBy('createdAt', 'desc'),
        fbLimit(5)
      );
      const ticketsSnap = await getDocs(ticketsQ);
      const maintenanceTickets = ticketsSnap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as MaintenanceTicket & { id: string };
      });

      const alertsQ = query(
        collection(db, 'alerts'),
        where('userId', '==', uid),
        where('archived', '==', false)
      );
      const alertsSnap = await getDocs(alertsQ);

      setActivityData(prev => ({
        ...prev,
        [uid]: { recentPayments, maintenanceTickets, alertCount: alertsSnap.size },
      }));
    } catch (err) {
      console.error('Error fetching user activity:', err);
    } finally {
      setActivityLoading(null);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    if (uid === userProfile?.uid && newRole !== 'admin') {
      if (!confirm('Remove your own admin access? You will lose access to this page.')) return;
    }
    try {
      setUpdatingUser(uid);
      await updateDoc(doc(db, 'users', uid), { role: newRole, updatedAt: new Date() });
      setUsers(prev => prev.map(u => (u.uid === uid ? { ...u, role: newRole, updatedAt: new Date() } : u)));
    } catch (err) {
      console.error('Error updating user role:', err);
      alert('Failed to update user role.');
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!createForm.email || !createForm.password || !createForm.displayName) {
      setCreateError('All fields are required.');
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError('Password must be at least 6 characters.');
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      setCreateError('Passwords do not match.');
      return;
    }
    try {
      setCreateLoading(true);
      await adminCreateUser(createForm.email, createForm.password, createForm.displayName, createForm.role);
      await fetchUsers();
      setShowCreateModal(false);
      setCreateForm({ email: '', password: '', confirmPassword: '', displayName: '', role: 'applicant' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      if (msg === 'EMAIL_EXISTS') setCreateError('An account with that email already exists.');
      else if (msg.includes('WEAK_PASSWORD')) setCreateError('Password must be at least 6 characters.');
      else if (msg === 'INVALID_EMAIL') setCreateError('Please enter a valid email address.');
      else setCreateError(msg);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTarget) return;
    try {
      setSendingNotice(true);
      await alertService.create({
        userId: noticeTarget.uid,
        type: 'general',
        title: noticeForm.title,
        message: noticeForm.message,
        read: false,
        archived: false,
      });
      setNoticeTarget(null);
      setNoticeForm({ title: '', message: '' });
      alert('Notice sent successfully!');
    } catch (err) {
      console.error('Error sending notice:', err);
      alert('Failed to send notice.');
    } finally {
      setSendingNotice(false);
    }
  };

  const handleBulkNotice = async () => {
    const title = prompt('Notice title:');
    if (!title) return;
    const message = prompt('Notice message:');
    if (!message) return;
    if (!confirm(`Send this notice to ${filteredUsers.length} user(s)?`)) return;
    try {
      setLoading(true);
      await Promise.all(
        filteredUsers.map(u =>
          alertService.create({ userId: u.uid, type: 'general', title, message, read: false, archived: false })
        )
      );
      alert(`Notice sent to ${filteredUsers.length} user(s).`);
    } catch (err) {
      console.error('Bulk notice error:', err);
      alert('Some notices failed to send.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    try {
      setResettingPassword(true);
      setResetMessage(null);
      await adminSendPasswordReset(resetTarget.email);
      setResetMessage(`Password reset email sent to ${resetTarget.email}. The user will receive a link to set a new password.`);
    } catch (err) {
      console.error('Error sending password reset:', err);
      setResetMessage('Failed to send password reset email. Please try again.');
    } finally {
      setResettingPassword(false);
    }
  };

  const toggleExpand = (uid: string) => {
    if (expandedUid === uid) {
      setExpandedUid(null);
    } else {
      setExpandedUid(uid);
      fetchUserActivity(uid);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Filtering                                                        */
  /* ---------------------------------------------------------------- */

  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      user.email?.toLowerCase().includes(term) ||
      user.displayName?.toLowerCase().includes(term) ||
      user.phone?.toLowerCase().includes(term);
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  const getRoleBadge = (role: UserRole) => {
    const map: Record<UserRole, { cls: string; icon: React.ReactNode }> = {
      admin: { cls: 'badge-admin', icon: <Shield size={12} /> },
      tenant: { cls: 'badge-tenant', icon: <UserCheck size={12} /> },
      applicant: { cls: 'badge-applicant', icon: <UserX size={12} /> },
    };
    return map[role] || map.applicant;
  };

  const formatCents = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading && users.length === 0) {
    return (
      <div className="users-page">
        <div className="loading-state"><div className="spinner" /><p>Loading users…</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="users-page">
        <div className="error-state">
          <XCircle size={32} />
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchUsers} className="btn-primary">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="users-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>User Management</h1>
          <p>Manage accounts, roles, activity &amp; send notices</p>
        </div>
        <div className="header-actions">
          <button onClick={fetchUsers} className="btn-secondary" title="Refresh">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={handleBulkNotice} className="btn-secondary" title="Send notice to filtered users">
            <Send size={16} /> Bulk Notice
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <UserPlus size={16} /> Create User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="users-stats">
        <div className="stat-card">
          <Users size={20} className="stat-icon" />
          <span className="stat-value">{users.length}</span>
          <span className="stat-label">Total Users</span>
        </div>
        <div className="stat-card stat-admin">
          <Shield size={20} className="stat-icon" />
          <span className="stat-value">{users.filter(u => u.role === 'admin').length}</span>
          <span className="stat-label">Admins</span>
        </div>
        <div className="stat-card stat-tenant">
          <UserCheck size={20} className="stat-icon" />
          <span className="stat-value">{users.filter(u => u.role === 'tenant').length}</span>
          <span className="stat-label">Tenants</span>
        </div>
        <div className="stat-card stat-applicant">
          <UserX size={20} className="stat-icon" />
          <span className="stat-value">{users.filter(u => u.role === 'applicant').length}</span>
          <span className="stat-label">Applicants</span>
        </div>
      </div>

      {/* Filters */}
      <div className="users-filters">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, email, or phone…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="role-filter">
          <select value={filterRole} onChange={e => setFilterRole(e.target.value as UserRole | 'all')}>
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="tenant">Tenants</option>
            <option value="applicant">Applicants</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th>User</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr><td colSpan={7} className="empty-state">No users found</td></tr>
            ) : (
              filteredUsers.map(user => {
                const badge = getRoleBadge(user.role);
                const isExpanded = expandedUid === user.uid;
                return (
                  <Fragment key={user.uid}>
                    <tr className={`${user.uid === userProfile?.uid ? 'current-user' : ''} ${isExpanded ? 'row-expanded' : ''}`}>
                      <td>
                        <button className="expand-btn" onClick={() => toggleExpand(user.uid)} title="View activity">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                      <td>
                        <div className="user-info">
                          <div className="user-avatar">
                            {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="user-details">
                            <span className="user-name">
                              {user.displayName || 'No name'}
                              {user.uid === userProfile?.uid && <span className="you-badge">You</span>}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="cell-email">{user.email}</td>
                      <td className="cell-phone">{user.phone || '—'}</td>
                      <td>
                        <span className={`role-badge ${badge.cls}`}>
                          {badge.icon} {user.role}
                        </span>
                      </td>
                      <td className="cell-date">{formatDate(user.createdAt)}</td>
                      <td>
                        <div className="action-buttons">
                          <select
                            value={user.role}
                            onChange={e => updateUserRole(user.uid, e.target.value as UserRole)}
                            disabled={updatingUser === user.uid}
                            className="role-select"
                          >
                            <option value="admin">Admin</option>
                            <option value="tenant">Tenant</option>
                            <option value="applicant">Applicant</option>
                          </select>
                          <button
                            className="btn-icon"
                            title="Send notice"
                            onClick={() => { setNoticeTarget(user); setNoticeForm({ title: '', message: '' }); }}
                          >
                            <Mail size={16} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Reset password"
                            onClick={() => { setResetTarget(user); setResetMessage(null); }}
                          >
                            <KeyRound size={16} />
                          </button>
                          <button className="btn-icon" title="View details" onClick={() => toggleExpand(user.uid)}>
                            <Eye size={16} />
                          </button>
                          {user.role === 'tenant' && (
                            <Link to={`/admin/tenants/${user.uid}`} className="btn-icon" title="View Tenant Profile">
                              <Users size={16} />
                            </Link>
                          )}
                          {updatingUser === user.uid && <span className="updating-indicator">Saving…</span>}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="activity-row">
                        <td colSpan={7}>
                          <UserActivityPanel
                            activity={activityData[user.uid]}
                            loading={activityLoading === user.uid}
                            formatCents={formatCents}
                            formatDate={formatDate}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="users-help">
        <h3>Role Permissions</h3>
        <ul>
          <li><strong>Admin:</strong> Full access — manage users, properties, tenants, settings, payments, etc.</li>
          <li><strong>Tenant:</strong> View lease, make payments, submit maintenance requests, upload documents</li>
          <li><strong>Applicant:</strong> View available properties, submit rental applications, upload documents</li>
        </ul>
      </div>

      {/* ==================== Create User Modal ==================== */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><UserPlus size={20} /> Create New User</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateUser} className="modal-body">
              {createError && (
                <div className="form-error"><AlertTriangle size={16} /> {createError}</div>
              )}
              <label className="form-label">
                Display Name
                <input type="text" value={createForm.displayName} onChange={e => setCreateForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Jane Smith" required />
              </label>
              <label className="form-label">
                Email
                <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" required />
              </label>
              <label className="form-label">
                Password
                <input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" minLength={6} required />
              </label>
              <label className="form-label">
                Confirm Password
                <input type="password" value={createForm.confirmPassword} onChange={e => setCreateForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Re-enter password" minLength={6} required />
              </label>
              <label className="form-label">
                Role
                <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                  <option value="admin">Admin</option>
                  <option value="tenant">Tenant</option>
                  <option value="applicant">Applicant</option>
                </select>
              </label>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createLoading}>
                  {createLoading ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== Send Notice Modal ==================== */}
      {noticeTarget && (
        <div className="modal-overlay" onClick={() => setNoticeTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Send size={20} /> Send Notice</h2>
              <button className="modal-close" onClick={() => setNoticeTarget(null)}><X size={20} /></button>
            </div>
            <p className="notice-to">To: <strong>{noticeTarget.displayName}</strong> ({noticeTarget.email})</p>
            <form onSubmit={handleSendNotice} className="modal-body">
              <label className="form-label">
                Subject
                <input type="text" value={noticeForm.title} onChange={e => setNoticeForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Rent Reminder" required />
              </label>
              <label className="form-label">
                Message
                <textarea value={noticeForm.message} onChange={e => setNoticeForm(f => ({ ...f, message: e.target.value }))} placeholder="Type your notice here…" rows={5} required />
              </label>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setNoticeTarget(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={sendingNotice}>
                  {sendingNotice ? 'Sending…' : 'Send Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== Reset Password Modal ==================== */}
      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><KeyRound size={20} /> Reset User Password</h2>
              <button className="modal-close" onClick={() => setResetTarget(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p className="notice-to">User: <strong>{resetTarget.displayName}</strong> ({resetTarget.email})</p>
              {resetMessage ? (
                <div style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: resetMessage.includes('Failed') ? '#FEF2F2' : '#F0FDF4',
                  color: resetMessage.includes('Failed') ? '#DC2626' : '#16A34A',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  marginBottom: '1rem',
                }}>
                  {resetMessage}
                </div>
              ) : (
                <p style={{ fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.6, marginBottom: '1rem' }}>
                  This will send a password reset email to <strong>{resetTarget.email}</strong>.
                  The user will receive a link to create a new password. Let them know to check their email (including spam folder).
                </p>
              )}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>
                  {resetMessage ? 'Close' : 'Cancel'}
                </button>
                {!resetMessage && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleResetPassword}
                    disabled={resettingPassword}
                  >
                    {resettingPassword ? 'Sending…' : 'Send Reset Email'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
