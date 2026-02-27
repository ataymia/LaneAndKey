import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { alertService } from '../../lib/firebase/firestore';
import { assignLease } from '../../lib/api/portalApi';
import type { UserProfile, Tenant, Property } from '../../types';
import {
  Users,
  Search,
  Mail,
  Home,
  DollarSign,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import './Tenants.css';

interface TenantRow {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  propertyAddress: string;
  unit: string;
  leaseEnd: string;
  balance: number;
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
    rentAmountCents: '',
    depositAmountCents: '',
  });
  const [assigning, setAssigning] = useState(false);

  // Notice modal
  const [noticeTarget, setNoticeTarget] = useState<TenantRow | null>(null);
  const [noticeForm, setNoticeForm] = useState({ title: '', message: '' });
  const [sendingNotice, setSendingNotice] = useState(false);

  // Expanded row
  const [, ] = useState<string | null>(null);

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
      // Sort client-side to avoid needing composite index
      tenantUsers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Fetch tenant docs
      const tenantsSnap = await getDocs(collection(db, 'tenants'));
      const tenantDocs = tenantsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Tenant));

      // Fetch properties
      const propsSnap = await getDocs(collection(db, 'properties'));
      const propDocs = propsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Property));
      setProperties(propDocs);

      // Build lookup maps
      const propMap = new Map(propDocs.map(p => [p.id, p]));
      const tenantDocMap = new Map(tenantDocs.map(t => [t.userId, t]));

      // Merge
      const rows: TenantRow[] = tenantUsers.map(u => {
        const tenantDoc = tenantDocMap.get(u.uid);
        const prop = tenantDoc?.propertyId ? propMap.get(tenantDoc.propertyId) : null;
        return {
          uid: u.uid,
          displayName: u.displayName || u.email || '',
          email: u.email,
          phone: u.phone || '',
          propertyAddress: prop?.address || 'Unassigned',
          unit: prop?.unit || '',
          leaseEnd: '', // would come from lease doc
          balance: tenantDoc?.balance ?? 0,
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
    setAssignForm({
      propertyId: '',
      startDate: new Date().toISOString().slice(0, 10),
      rentAmountCents: '',
      depositAmountCents: '',
    });
  };

  const handleAssignLease = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignTarget || !assignForm.propertyId) return;

    const rentAmountCents = Math.round(Number(assignForm.rentAmountCents));
    const depositAmountCents = Math.round(Number(assignForm.depositAmountCents || 0));

    if (!Number.isFinite(rentAmountCents) || rentAmountCents <= 0) {
      alert('Rent amount must be a valid positive cent value.');
      return;
    }

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
      setAssignTarget(null);
      await fetchTenants();
    } catch (error) {
      console.error('Failed to assign lease:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign lease.');
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
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(cents) / 100);

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
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map(tenant => (
                <tr key={tenant.uid}>
                  <td>
                    <div className="tenant-info">
                      <div className="avatar">{tenant.displayName.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="tenant-name">{tenant.displayName}</div>
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
                    <span className={`balance ${tenant.balance > 0 ? 'due' : ''}`}>
                      <DollarSign size={14} />
                      {formatCurrency(tenant.balance)}
                    </span>
                  </td>
                  <td>{tenant.createdAt.toLocaleDateString()}</td>
                  <td>
                    <div className="tenant-actions">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => openAssignModal(tenant)}
                        title="Assign property"
                      >
                        Assign Lease
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => { setNoticeTarget(tenant); setNoticeForm({ title: '', message: '' }); }}
                        title="Send notice"
                      >
                        <Send size={14} />
                      </button>
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
              <label className="form-label">
                Property
                <select
                  value={assignForm.propertyId}
                  onChange={e => setAssignForm(f => ({ ...f, propertyId: e.target.value }))}
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
                Rent Amount (cents)
                <input
                  type="number"
                  min="1"
                  value={assignForm.rentAmountCents}
                  onChange={e => setAssignForm(f => ({ ...f, rentAmountCents: e.target.value }))}
                  required
                />
              </label>
              <label className="form-label">
                Deposit Amount (cents)
                <input
                  type="number"
                  min="0"
                  value={assignForm.depositAmountCents}
                  onChange={e => setAssignForm(f => ({ ...f, depositAmountCents: e.target.value }))}
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
