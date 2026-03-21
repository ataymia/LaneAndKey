import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase/config';
import { alertService, leaseService } from '../../lib/firebase/firestore';
import { rentStatementService } from '../../lib/firebase/rentStatements';
import { assignLease } from '../../lib/api/portalApi';
import type { UserProfile, Property, Lease } from '../../types';
import {
  Users,
  Search,
  Mail,
  Home,
  DollarSign,
  RefreshCw,
  Send,
  X,
  ChevronDown,
  Plus,
  Minus,
  Edit,
  FileText,
  CreditCard,
  Wrench,
  Eye,
} from 'lucide-react';
import './Tenants.css';

interface TenantRow {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  propertyAddress: string;
  propertyId: string;
  unit: string;
  leaseEnd: string;
  leaseId: string;
  balanceCents: number;
  createdAt: Date;
}

export function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProperty, setFilterProperty] = useState('all');
  const [properties, setProperties] = useState<Property[]>([]);

  // Assign lease modal
  const [assignTarget, setAssignTarget] = useState<TenantRow | null>(null);
  const [assignForm, setAssignForm] = useState({
    propertyId: '',
    startDate: new Date().toISOString().slice(0, 10),
    rentDollars: '',
    depositDollars: '',
  });
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Notice modal
  const [noticeTarget, setNoticeTarget] = useState<TenantRow | null>(null);
  const [noticeForm, setNoticeForm] = useState({ title: '', message: '' });
  const [sendingNotice, setSendingNotice] = useState(false);

  // Actions dropdown
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all users with role === 'tenant'
      const usersQ = query(collection(db, 'users'), where('role', '==', 'tenant'));
      const usersSnap = await getDocs(usersQ);
      const tenantUsers = usersSnap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          uid: d.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as UserProfile;
      });
      tenantUsers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Fetch properties
      const propsSnap = await getDocs(collection(db, 'properties'));
      const propDocs = propsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Property));
      setProperties(propDocs);

      // Fetch active leases + rent statements in parallel
      const [activeLeases, allStatements] = await Promise.all([
        leaseService.getActive(),
        rentStatementService.getAll(),
      ]);

      // Build lookup maps
      const propMap = new Map(propDocs.map(p => [p.id, p]));
      // Map from tenantUid → their active lease
      const leaseByTenant = new Map<string, Lease>();
      for (const l of activeLeases) {
        if (l.tenantUid) leaseByTenant.set(l.tenantUid, l);
      }
      // Map from tenantUid → total open balance cents
      const balanceByTenant = new Map<string, number>();
      for (const s of allStatements) {
        if (s.status === 'open') {
          balanceByTenant.set(s.tenantUid, (balanceByTenant.get(s.tenantUid) || 0) + s.balanceCents);
        }
      }

      // Merge
      const rows: TenantRow[] = tenantUsers.map(u => {
        // Resolve property from active lease or from user.currentPropertyId
        const lease = leaseByTenant.get(u.uid);
        const propertyId = lease?.propertyId || u.currentPropertyId || '';
        const prop = propertyId ? propMap.get(propertyId) : null;
        const endDate = lease?.endDate ? new Date(lease.endDate).toLocaleDateString() : '';
        return {
          uid: u.uid,
          displayName: u.displayName || u.email || '',
          email: u.email,
          phone: u.phone || '',
          propertyAddress: prop?.address || 'Unassigned',
          propertyId,
          unit: prop?.unit || '',
          leaseEnd: endDate,
          leaseId: lease?.id || '',
          balanceCents: balanceByTenant.get(u.uid) || 0,
          createdAt: u.createdAt,
        };
      });

      setTenants(rows);
    } catch (err) {
      console.error('Error fetching tenants:', err);
      setError('Failed to load tenants.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

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
      alert('Notice sent!');
    } catch {
      alert('Failed to send notice.');
    } finally {
      setSendingNotice(false);
    }
  };

  const openAssignModal = (tenant: TenantRow) => {
    setAssignTarget(tenant);
    setAssignError(null);
    setAssignSuccess(null);
    setAssignForm({
      propertyId: '',
      startDate: new Date().toISOString().slice(0, 10),
      rentDollars: '',
      depositDollars: '',
    });
  };

  // Auto-fill rent/deposit when a property is selected
  const handlePropertyChange = (propertyId: string) => {
    setAssignForm((f) => {
      const prop = properties.find((p) => p.id === propertyId);
      return {
        ...f,
        propertyId,
        rentDollars: prop?.monthlyRent ? String(prop.monthlyRent) : '',
        depositDollars: prop?.securityDeposit ? String(prop.securityDeposit) : '',
      };
    });
  };

  const handleAssignLease = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignTarget || !assignForm.propertyId) return;
    setAssignError(null);

    const rentDollars = Number(assignForm.rentDollars);
    const depositDollars = Number(assignForm.depositDollars || 0);

    if (!Number.isFinite(rentDollars) || rentDollars <= 0) {
      setAssignError('Rent amount must be a valid positive value.');
      return;
    }

    const rentAmountCents = Math.round(rentDollars * 100);
    const depositAmountCents = Math.round(depositDollars * 100);

    try {
      setAssigning(true);
      await assignLease({
        tenantUid: assignTarget.uid,
        propertyId: assignForm.propertyId,
        startDate: assignForm.startDate,
        rentAmountCents,
        depositAmountCents,
        endCurrentLease: true,
      });
      setAssignSuccess(`Lease assigned to ${assignTarget.displayName} successfully.`);
      setAssignTarget(null);
      await fetchTenants();
      // Auto-dismiss success after 4 seconds
      setTimeout(() => setAssignSuccess(null), 4000);
    } catch (error) {
      console.error('Assign lease failed:', { error, propertyId: assignForm.propertyId, tenantUid: assignTarget.uid });
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('FAILED_PRECONDITION') || msg.includes('index')) {
        setAssignError('Database index missing for this query. Please deploy Firestore indexes (see docs). Run: firebase deploy --only firestore:indexes');
      } else {
        setAssignError(msg || 'Failed to assign lease.');
      }
    } finally {
      setAssigning(false);
    }
  };

  const filteredTenants = tenants.filter(t => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      t.displayName.toLowerCase().includes(term) ||
      t.email.toLowerCase().includes(term) ||
      t.phone.includes(term);
    const matchProp = filterProperty === 'all' || t.propertyAddress === filterProperty;
    return matchSearch && matchProp;
  });

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  if (loading) {
    return (
      <div className="tenants-page">
        <div className="loading-state"><div className="spinner" /><p>Loading tenants…</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tenants-page">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={fetchTenants} className="btn btn-primary">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tenants-page">
      {assignSuccess && (
        <div style={{ background: '#dcfce7', color: '#166534', padding: '0.75rem 1rem', borderRadius: '0.375rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>&#10003;</span> {assignSuccess}
        </div>
      )}
      <div className="page-header">
        <div>
          <h1>Tenants</h1>
          <p>{tenants.length} total tenant{tenants.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="header-actions">
          <button onClick={fetchTenants} className="btn btn-outline" title="Refresh">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search tenants…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)}>
            <option value="all">All Properties</option>
            {[...new Set(tenants.map(t => t.propertyAddress))].filter(Boolean).map(addr => (
              <option key={addr} value={addr}>{addr}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredTenants.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Property</th>
                <th>Phone</th>
                <th>Balance</th>
                <th>Lease End</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map(tenant => (
                <tr key={tenant.uid} className="clickable-row" onClick={() => navigate(`/admin/tenants/${tenant.uid}`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="tenant-info">
                      <div className="avatar">{tenant.displayName.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="tenant-name">
                          <Link to={`/admin/tenants/${tenant.uid}`} onClick={e => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {tenant.displayName}
                          </Link>
                        </div>
                        <div className="tenant-contact">
                          <Mail size={12} /> {tenant.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="property-info">
                      <Home size={14} />
                      {tenant.propertyAddress}
                      {tenant.unit && ` #${tenant.unit}`}
                    </div>
                  </td>
                  <td>{tenant.phone || '—'}</td>
                  <td>
                    <span className={`balance ${tenant.balanceCents > 0 ? 'due' : ''}`}>
                      <DollarSign size={14} />
                      {formatCurrency(tenant.balanceCents)}
                    </span>
                  </td>
                  <td>{tenant.leaseEnd || '—'}</td>
                  <td>{tenant.createdAt.toLocaleDateString()}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="tenant-actions" style={{ position: 'relative' }}>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => setMenuOpen(menuOpen === tenant.uid ? null : tenant.uid)}
                        title="Actions"
                      >
                        Actions <ChevronDown size={12} />
                      </button>
                      {menuOpen === tenant.uid && (
                        <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, minWidth: '220px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '0.25rem 0', marginTop: '4px' }} onClick={() => setMenuOpen(null)}>
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`/admin/tenants/${tenant.uid}`)}><Eye size={14} /> View Profile</button>
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => openAssignModal(tenant)}><Home size={14} /> Assign / Change Property</button>
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`/admin/tenants/${tenant.uid}?tab=lease`)}><Edit size={14} /> Edit Lease Terms</button>
                          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0.25rem 0' }} />
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`/admin/tenants/${tenant.uid}?tab=statements`)}><Plus size={14} /> Add Fee</button>
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`/admin/tenants/${tenant.uid}?tab=statements`)}><Minus size={14} /> Add Credit</button>
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`/admin/tenants/${tenant.uid}?tab=statements`)}><DollarSign size={14} /> Add Adjustment</button>
                          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0.25rem 0' }} />
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => { setNoticeTarget(tenant); setNoticeForm({ title: '', message: '' }); }}><Send size={14} /> Send Notice</button>
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`/admin/tenants/${tenant.uid}?tab=documents`)}><FileText size={14} /> Upload Lease & Send</button>
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`/admin/tenants/${tenant.uid}?tab=documents`)}><FileText size={14} /> View Documents</button>
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`/admin/tenants/${tenant.uid}?tab=payments`)}><CreditCard size={14} /> View Payment History</button>
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`/admin/tenants/${tenant.uid}?tab=maintenance`)}><Wrench size={14} /> View Maintenance</button>
                          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0.25rem 0' }} />
                          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 1rem', border: 'none', background: 'none', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`/admin/tenants/${tenant.uid}?tab=lease`)}><Users size={14} /> Manage Occupants</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Users size={32} />
          </div>
          <h3 className="empty-state-title">No tenants found</h3>
          <p className="empty-state-description">
            {searchTerm || filterProperty !== 'all'
              ? 'No tenants match your search criteria.'
              : 'Create tenant accounts from the Users page or approve applications.'}
          </p>
        </div>
      )}

      {/* Send Notice Modal */}
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
                <input type="text" value={noticeForm.title} onChange={e => setNoticeForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Lease Renewal Notice" required />
              </label>
              <label className="form-label">
                Message
                <textarea value={noticeForm.message} onChange={e => setNoticeForm(f => ({ ...f, message: e.target.value }))} placeholder="Type your notice here…" rows={5} required />
              </label>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setNoticeTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={sendingNotice}>
                  {sendingNotice ? 'Sending…' : 'Send Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Lease Modal */}
      {assignTarget && (
        <div className="modal-overlay" onClick={() => setAssignTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Lease</h2>
              <button className="modal-close" onClick={() => setAssignTarget(null)}><X size={20} /></button>
            </div>
            <p className="notice-to">Tenant: <strong>{assignTarget.displayName}</strong> ({assignTarget.email})</p>
            <form onSubmit={handleAssignLease} className="modal-body">
              {assignError && (
                <div className="form-error" style={{ color: '#dc2626', background: '#fef2f2', padding: '0.75rem 1rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  {assignError}
                </div>
              )}
              <label className="form-label">
                Property
                <select
                  value={assignForm.propertyId}
                  onChange={e => handlePropertyChange(e.target.value)}
                  required
                >
                  <option value="">Select property</option>
                  {properties.map(property => (
                    <option key={property.id} value={property.id}>
                      {property.address}{property.unit ? ` #${property.unit}` : ''} ({property.occupancyStatus})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Lease Start Date
                <input
                  type="date"
                  value={assignForm.startDate}
                  onChange={e => setAssignForm(f => ({ ...f, startDate: e.target.value }))}
                  required
                />
              </label>
              <label className="form-label">
                Monthly Rent ($)
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="e.g. 1500.00"
                  value={assignForm.rentDollars}
                  onChange={e => setAssignForm(f => ({ ...f, rentDollars: e.target.value }))}
                  required
                />
              </label>
              <label className="form-label">
                Security Deposit ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 1500.00"
                  value={assignForm.depositDollars}
                  onChange={e => setAssignForm(f => ({ ...f, depositDollars: e.target.value }))}
                />
              </label>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setAssignTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={assigning}>
                  {assigning ? 'Assigning…' : 'Assign Lease'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
