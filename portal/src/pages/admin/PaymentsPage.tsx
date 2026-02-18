import { useState, useEffect } from 'react';
import {
  DollarSign,
  Search,
  Filter,
  Plus,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  X,
} from 'lucide-react';
import { paymentService, propertyService } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import type { Payment, Property, UserProfile } from '../../types';
import './Payments.css';

interface RecordPaymentForm {
  tenantUid: string;
  propertyId: string;
  amount: string;
  type: Payment['type'];
  method: Payment['method'];
  status: Payment['status'];
  notes: string;
}

const emptyForm: RecordPaymentForm = {
  tenantUid: '',
  propertyId: '',
  amount: '',
  type: 'rent',
  method: 'cash',
  status: 'completed',
  notes: '',
};

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Record Payment modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<RecordPaymentForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Lookups
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<UserProfile[]>([]);
  const [tenantMap, setTenantMap] = useState<Record<string, string>>({});
  const [propertyMap, setPropertyMap] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPayments();
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const [props, tenantSnap] = await Promise.all([
        propertyService.getAll(),
        getDocs(query(collection(db, 'users'), where('role', '==', 'tenant'))),
      ]);
      setProperties(props);
      const propMap: Record<string, string> = {};
      props.forEach(p => { propMap[p.id] = p.address + (p.unit ? ` #${p.unit}` : ''); });
      setPropertyMap(propMap);

      const tenantUsers = tenantSnap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
      setTenants(tenantUsers);
      const tMap: Record<string, string> = {};
      tenantUsers.forEach(t => { tMap[t.uid] = t.displayName || t.email; });
      setTenantMap(tMap);
    } catch (error) {
      console.error('Error loading lookups:', error);
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await paymentService.getAll();
      setPayments(data);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantUid || !form.propertyId || !form.amount) return;
    try {
      setSaving(true);
      const amountCents = Math.round(parseFloat(form.amount) * 100);
      await paymentService.create({
        leaseId: '',
        tenantId: form.tenantUid,
        tenantUid: form.tenantUid,
        propertyId: form.propertyId,
        amount: amountCents,
        type: form.type,
        method: form.method,
        status: form.status,
        dueDate: new Date(),
        paidDate: form.status === 'completed' ? new Date() : undefined,
        notes: form.notes || undefined,
      });
      setShowModal(false);
      setForm({ ...emptyForm });
      await loadPayments();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} className="text-success" />;
      case 'pending': return <Clock size={16} className="text-warning" />;
      case 'failed': return <XCircle size={16} className="text-error" />;
      default: return <Clock size={16} />;
    }
  };

  // Summary calculations
  const now = new Date();
  const thisMonth = payments.filter(p => {
    const d = p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const collectedThisMonth = thisMonth.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  const pendingTotal = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const failedTotal = payments.filter(p => p.status === 'failed').reduce((s, p) => s + p.amount, 0);

  // Filtering
  const filtered = payments.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const tName = (tenantMap[p.tenantUid] || p.tenantId || '').toLowerCase();
      const pName = (propertyMap[p.propertyId] || p.propertyId || '').toLowerCase();
      return tName.includes(q) || pName.includes(q) || p.type.includes(q) || p.method.includes(q);
    }
    return true;
  });

  return (
    <div className="payments-page">
      <div className="page-header">
        <div>
          <h1>Payments</h1>
          <p>Track rent payments and manage transactions</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Record Payment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="payments-summary">
        <div className="summary-card">
          <div className="summary-icon success">
            <DollarSign size={20} />
          </div>
          <div>
            <div className="summary-value">{formatCurrency(collectedThisMonth)}</div>
            <div className="summary-label">Collected This Month</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon warning">
            <Clock size={20} />
          </div>
          <div>
            <div className="summary-value">{formatCurrency(pendingTotal)}</div>
            <div className="summary-label">Pending</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon error">
            <XCircle size={20} />
          </div>
          <div>
            <div className="summary-value">{formatCurrency(failedTotal)}</div>
            <div className="summary-label">Failed</div>
          </div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search payments..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <Filter size={16} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /><p>Loading payments…</p></div>
      ) : filtered.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tenant</th>
                <th>Property</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Status</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(payment => (
                <tr key={payment.id}>
                  <td>
                    <div className="date-cell">
                      <Calendar size={14} />
                      {(payment.createdAt instanceof Date ? payment.createdAt : new Date(payment.createdAt)).toLocaleDateString()}
                    </div>
                  </td>
                  <td>{tenantMap[payment.tenantUid] || tenantMap[payment.tenantId] || payment.tenantId?.slice(0, 8) + '...'}</td>
                  <td>{propertyMap[payment.propertyId] || payment.propertyId?.slice(0, 8) + '...'}</td>
                  <td className="amount-cell">{formatCurrency(payment.amount)}</td>
                  <td><span className="badge badge-gray">{payment.type}</span></td>
                  <td>
                    <span className={`badge badge-${getStatusColor(payment.status)}`}>
                      {getStatusIcon(payment.status)}
                      {payment.status}
                    </span>
                  </td>
                  <td>{payment.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <DollarSign size={32} />
          </div>
          <h3 className="empty-state-title">No payments yet</h3>
          <p className="empty-state-description">
            Payments will appear here once tenants make payments or you record them manually.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Record Payment
          </button>
        </div>
      )}

      {/* Record Payment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><DollarSign size={20} /> Record Payment</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleRecordPayment} className="modal-body">
              <label className="form-label">
                Tenant *
                <select
                  value={form.tenantUid}
                  onChange={e => setForm(f => ({ ...f, tenantUid: e.target.value }))}
                  required
                >
                  <option value="">Select a tenant</option>
                  {tenants.map(t => (
                    <option key={t.uid} value={t.uid}>{t.displayName || t.email}</option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Property *
                <select
                  value={form.propertyId}
                  onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}
                  required
                >
                  <option value="">Select a property</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.address}{p.unit ? ` #${p.unit}` : ''}</option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Amount ($) *
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label className="form-label">
                  Type
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Payment['type'] }))}>
                    <option value="rent">Rent</option>
                    <option value="deposit">Deposit</option>
                    <option value="fee">Fee</option>
                    <option value="late_fee">Late Fee</option>
                    <option value="application_fee">Application Fee</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="form-label">
                  Method
                  <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value as Payment['method'] }))}>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="stripe">Stripe</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              <label className="form-label">
                Status
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Payment['status'] }))}>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                </select>
              </label>
              <label className="form-label">
                Notes
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Optional notes about this payment"
                />
              </label>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'success';
    case 'pending': return 'warning';
    case 'processing': return 'info';
    case 'failed': return 'error';
    default: return 'gray';
  }
}
