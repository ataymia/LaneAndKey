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
} from 'lucide-react';
import { paymentService } from '../../lib/firebase';
import type { Payment } from '../../types';
import './Payments.css';

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      // Would need to get all payments or paginate
      const data = await paymentService.getByStatus('completed');
      setPayments(data);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} className="text-success" />;
      case 'pending': return <Clock size={16} className="text-warning" />;
      case 'failed': return <XCircle size={16} className="text-error" />;
      default: return <Clock size={16} />;
    }
  };

  return (
    <div className="payments-page">
      <div className="page-header">
        <div>
          <h1>Payments</h1>
          <p>Track rent payments and manage transactions</p>
        </div>
        <button className="btn btn-primary">
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
            <div className="summary-value">$0</div>
            <div className="summary-label">Collected This Month</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon warning">
            <Clock size={20} />
          </div>
          <div>
            <div className="summary-value">$0</div>
            <div className="summary-label">Pending</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon error">
            <XCircle size={20} />
          </div>
          <div>
            <div className="summary-value">$0</div>
            <div className="summary-label">Overdue</div>
          </div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search payments..." />
        </div>
        <div className="filter-group">
          <Filter size={16} />
          <select>
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {payments.length > 0 ? (
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
              {payments.map(payment => (
                <tr key={payment.id}>
                  <td>
                    <div className="date-cell">
                      <Calendar size={14} />
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td>{payment.tenantId.slice(0, 8)}...</td>
                  <td>{payment.propertyId.slice(0, 8)}...</td>
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
          <button className="btn btn-primary">
            <Plus size={18} />
            Record Payment
          </button>
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
