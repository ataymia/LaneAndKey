import { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  MoreVertical,
  Eye,
  Send,
  Loader2,
  X,
} from 'lucide-react';
import { invoiceService, leaseService, userService, isFirebaseConfigured } from '../../lib/firebase';
import type { Invoice, Lease, InvoiceType, InvoiceStatus } from '../../types';
import './Invoices.css';

// Demo data
const DEMO_INVOICES: (Invoice & { tenantName?: string; propertyAddress?: string })[] = [
  {
    id: 'demo-inv-1',
    tenantUid: 'demo-tenant-001',
    tenantId: 'demo-tenant-001',
    leaseId: 'demo-lease-001',
    propertyId: 'demo-property-001',
    type: 'rent',
    description: 'January 2026 Rent',
    amountCents: 150000,
    dueDate: new Date(2026, 0, 1),
    status: 'due',
    createdAt: new Date(),
    updatedAt: new Date(),
    tenantName: 'Demo Tenant',
    propertyAddress: '123 Main St, Apt 4B',
  },
  {
    id: 'demo-inv-2',
    tenantUid: 'demo-tenant-002',
    tenantId: 'demo-tenant-002',
    leaseId: 'demo-lease-002',
    propertyId: 'demo-property-002',
    type: 'rent',
    description: 'January 2026 Rent',
    amountCents: 180000,
    dueDate: new Date(2026, 0, 1),
    status: 'overdue',
    createdAt: new Date(),
    updatedAt: new Date(),
    tenantName: 'John Smith',
    propertyAddress: '456 Oak Ave, Unit 2',
  },
  {
    id: 'demo-inv-3',
    tenantUid: 'demo-tenant-001',
    tenantId: 'demo-tenant-001',
    leaseId: 'demo-lease-001',
    propertyId: 'demo-property-001',
    type: 'late_fee',
    description: 'Late Fee - December 2025',
    amountCents: 5000,
    dueDate: new Date(2025, 11, 10),
    status: 'paid',
    paidAt: new Date(2025, 11, 15),
    createdAt: new Date(),
    updatedAt: new Date(),
    tenantName: 'Demo Tenant',
    propertyAddress: '123 Main St, Apt 4B',
  },
];

interface InvoiceWithDetails extends Invoice {
  tenantName?: string;
  propertyAddress?: string;
}

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  useEffect(() => {
    loadInvoices();
  }, []);
  
  const loadInvoices = async () => {
    try {
      setLoading(true);
      
      if (!isFirebaseConfigured) {
        setInvoices(DEMO_INVOICES);
        return;
      }
      
      const invoicesData = await invoiceService.getAll();
      
      // Enrich with tenant/property names (in production, you'd batch these)
      const enrichedInvoices = await Promise.all(
        invoicesData.map(async (inv) => {
          const user = await userService.get(inv.tenantUid);
          const lease = inv.leaseId ? await leaseService.get(inv.leaseId) : null;
          return {
            ...inv,
            tenantName: user?.displayName || 'Unknown Tenant',
            propertyAddress: lease?.propertyId || 'Unknown Property',
          };
        })
      );
      
      setInvoices(enrichedInvoices);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };
  
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  const getStatusBadge = (status: InvoiceStatus) => {
    const config = {
      paid: { icon: CheckCircle, color: 'success', label: 'Paid' },
      due: { icon: Clock, color: 'warning', label: 'Due' },
      overdue: { icon: AlertCircle, color: 'error', label: 'Overdue' },
      pending: { icon: Clock, color: 'info', label: 'Pending' },
      void: { icon: XCircle, color: 'gray', label: 'Void' },
      refunded: { icon: DollarSign, color: 'gray', label: 'Refunded' },
    };
    const { icon: Icon, color, label } = config[status] || config.pending;
    return (
      <span className={`badge badge-${color}`}>
        <Icon size={14} />
        {label}
      </span>
    );
  };
  
  const getTypeBadge = (type: InvoiceType) => {
    const labels: Record<InvoiceType, string> = {
      rent: 'Rent',
      deposit: 'Deposit',
      fee: 'Fee',
      late_fee: 'Late Fee',
      application_fee: 'App Fee',
      other: 'Other',
    };
    return <span className="badge badge-gray">{labels[type] || type}</span>;
  };
  
  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.tenantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.propertyAddress?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesType = typeFilter === 'all' || inv.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });
  
  // Calculate summary
  const summary = {
    totalDue: invoices.filter(i => i.status === 'due' || i.status === 'overdue').reduce((s, i) => s + i.amountCents, 0),
    overdue: invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amountCents, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amountCents, 0),
    overdueCount: invoices.filter(i => i.status === 'overdue').length,
  };
  
  if (loading) {
    return (
      <div className="invoices-page">
        <div className="loading-container">
          <Loader2 className="loading-spinner" size={48} />
          <p>Loading invoices...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="invoices-page">
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>Manage tenant invoices and track payments</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} />
          Create Invoice
        </button>
      </div>
      
      {/* Summary Cards */}
      <div className="invoices-summary">
        <div className="summary-card">
          <div className="summary-icon warning">
            <Clock size={20} />
          </div>
          <div>
            <div className="summary-value">{formatCurrency(summary.totalDue)}</div>
            <div className="summary-label">Outstanding</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon error">
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="summary-value">{formatCurrency(summary.overdue)}</div>
            <div className="summary-label">Overdue ({summary.overdueCount})</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon success">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="summary-value">{formatCurrency(summary.paid)}</div>
            <div className="summary-label">Collected</div>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <Filter size={16} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="due">Due</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </select>
        </div>
        <div className="filter-group">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="rent">Rent</option>
            <option value="deposit">Deposit</option>
            <option value="late_fee">Late Fee</option>
            <option value="fee">Fee</option>
          </select>
        </div>
      </div>
      
      {/* Invoices Table */}
      {filteredInvoices.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Tenant</th>
                <th>Type</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(invoice => (
                <tr key={invoice.id} className={invoice.status === 'overdue' ? 'overdue-row' : ''}>
                  <td>
                    <div className="invoice-cell">
                      <FileText size={16} className="invoice-icon" />
                      <div>
                        <div className="invoice-description">{invoice.description}</div>
                        <div className="invoice-id">#{invoice.id.slice(0, 8)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="tenant-cell">
                      <div className="tenant-name">{invoice.tenantName}</div>
                      <div className="property-address">{invoice.propertyAddress}</div>
                    </div>
                  </td>
                  <td>{getTypeBadge(invoice.type)}</td>
                  <td>
                    <div className="date-cell">
                      <Calendar size={14} />
                      {formatDate(invoice.dueDate)}
                    </div>
                  </td>
                  <td className="amount-cell">{formatCurrency(invoice.amountCents)}</td>
                  <td>{getStatusBadge(invoice.status)}</td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn-icon" title="View">
                        <Eye size={16} />
                      </button>
                      {(invoice.status === 'due' || invoice.status === 'overdue') && (
                        <button className="btn-icon" title="Send Reminder">
                          <Send size={16} />
                        </button>
                      )}
                      <button className="btn-icon" title="More">
                        <MoreVertical size={16} />
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
            <FileText size={48} />
          </div>
          <h3>No invoices found</h3>
          <p>
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first invoice to get started'}
          </p>
          {!searchTerm && statusFilter === 'all' && typeFilter === 'all' && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={18} />
              Create Invoice
            </button>
          )}
        </div>
      )}
      
      {/* Create Invoice Modal */}
      {showCreateModal && (
        <CreateInvoiceModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadInvoices();
          }}
        />
      )}
    </div>
  );
}

interface CreateInvoiceModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateInvoiceModal({ onClose, onCreated }: CreateInvoiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  
  const [formData, setFormData] = useState({
    leaseId: '',
    type: 'rent' as InvoiceType,
    description: '',
    amountDollars: '',
    dueDate: new Date().toISOString().split('T')[0],
  });
  
  useEffect(() => {
    loadLeases();
  }, []);
  
  const loadLeases = async () => {
    try {
      if (isFirebaseConfigured) {
        const data = await leaseService.getActive();
        setLeases(data);
      }
    } catch (err) {
      console.error('Error loading leases:', err);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.leaseId || !formData.description || !formData.amountDollars || !formData.dueDate) {
      setError('Please fill in all required fields');
      return;
    }
    
    const amount = parseFloat(formData.amountDollars);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      if (!isFirebaseConfigured) {
        // Demo mode - just close
        alert('Invoice creation is disabled in demo mode');
        onClose();
        return;
      }
      
      const lease = await leaseService.get(formData.leaseId);
      if (!lease) {
        setError('Selected lease not found');
        return;
      }
      
      await invoiceService.create({
        tenantUid: lease.tenantIds[0], // First tenant
        tenantId: lease.tenantIds[0],
        leaseId: formData.leaseId,
        propertyId: lease.propertyId,
        type: formData.type,
        description: formData.description,
        amountCents: Math.round(amount * 100),
        dueDate: new Date(formData.dueDate),
        status: 'due',
      });
      
      onCreated();
    } catch (err) {
      console.error('Error creating invoice:', err);
      setError('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Invoice</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            
            <div className="form-group">
              <label>Lease *</label>
              <select
                value={formData.leaseId}
                onChange={(e) => setFormData({ ...formData, leaseId: e.target.value })}
                required
              >
                <option value="">Select a lease...</option>
                {leases.map(lease => (
                  <option key={lease.id} value={lease.id}>
                    {lease.propertyId} - {formatCurrency(lease.monthlyRent * 100)}/mo
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as InvoiceType })}
                  required
                >
                  <option value="rent">Rent</option>
                  <option value="deposit">Security Deposit</option>
                  <option value="late_fee">Late Fee</option>
                  <option value="fee">Other Fee</option>
                  <option value="application_fee">Application Fee</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Due Date *</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Description *</label>
              <input
                type="text"
                placeholder="e.g., January 2026 Rent"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Amount ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amountDollars}
                onChange={(e) => setFormData({ ...formData, amountDollars: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create Invoice
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
