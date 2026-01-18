import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  ArrowRight,
  Calendar,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts';
import { invoiceService, paymentService, leaseService, isFirebaseConfigured } from '../../lib/firebase';
import { redirectToCheckout, isStripeConfigured } from '../../lib/stripe';
import type { Invoice, Payment, Lease } from '../../types';
import './TenantPaymentsPage.css';

// Demo data for when Firebase is not configured
const DEMO_INVOICES: Invoice[] = [
  {
    id: 'demo-invoice-1',
    tenantUid: 'demo-tenant-001',
    tenantId: 'demo-tenant-001',
    leaseId: 'demo-lease-001',
    propertyId: 'demo-property-001',
    type: 'rent',
    description: 'January 2026 Rent',
    amountCents: 150000, // $1,500
    dueDate: new Date(2026, 0, 1), // Jan 1, 2026
    status: 'due',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'demo-invoice-2',
    tenantUid: 'demo-tenant-001',
    tenantId: 'demo-tenant-001',
    leaseId: 'demo-lease-001',
    propertyId: 'demo-property-001',
    type: 'rent',
    description: 'February 2026 Rent',
    amountCents: 150000, // $1,500
    dueDate: new Date(2026, 1, 1), // Feb 1, 2026
    status: 'due',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const DEMO_PAYMENTS: Payment[] = [
  {
    id: 'demo-payment-1',
    leaseId: 'demo-lease-001',
    tenantId: 'demo-tenant-001',
    tenantUid: 'demo-tenant-001',
    propertyId: 'demo-property-001',
    invoiceId: 'demo-invoice-0',
    amount: 150000,
    type: 'rent',
    method: 'stripe',
    status: 'completed',
    dueDate: new Date(2025, 11, 1),
    paidDate: new Date(2025, 10, 28),
    createdAt: new Date(2025, 10, 28),
    updatedAt: new Date(2025, 10, 28),
  },
  {
    id: 'demo-payment-2',
    leaseId: 'demo-lease-001',
    tenantId: 'demo-tenant-001',
    tenantUid: 'demo-tenant-001',
    propertyId: 'demo-property-001',
    amount: 300000,
    type: 'deposit',
    method: 'stripe',
    status: 'completed',
    dueDate: new Date(2025, 5, 1),
    paidDate: new Date(2025, 5, 1),
    createdAt: new Date(2025, 5, 1),
    updatedAt: new Date(2025, 5, 1),
  },
];

const DEMO_LEASE: Lease = {
  id: 'demo-lease-001',
  propertyId: 'demo-property-001',
  tenantIds: ['demo-tenant-001'],
  startDate: new Date(2025, 5, 1),
  endDate: new Date(2026, 5, 1),
  monthlyRent: 1500,
  securityDeposit: 3000,
  rentDueDay: 1,
  gracePeriodDays: 5,
  attachments: [],
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function TenantPaymentsPage() {
  const { userProfile, isDemoMode } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [lease, setLease] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Check for success/cancel from Stripe redirect
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const canceled = searchParams.get('canceled');
    
    if (sessionId) {
      setSuccessMessage('Payment successful! Thank you for your payment.');
      // Clear the URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled) {
      setError('Payment was canceled. You can try again when ready.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);
  
  // Load data
  useEffect(() => {
    async function loadData() {
      if (!userProfile) return;
      
      try {
        setLoading(true);
        
        if (isDemoMode || !isFirebaseConfigured) {
          // Use demo data
          setInvoices(DEMO_INVOICES);
          setPayments(DEMO_PAYMENTS);
          setLease(DEMO_LEASE);
        } else {
          // Load from Firestore
          const [invoicesData, paymentsData] = await Promise.all([
            invoiceService.getByTenantUid(userProfile.uid),
            paymentService.getByTenantUid(userProfile.uid),
          ]);
          
          setInvoices(invoicesData);
          setPayments(paymentsData);
          
          // Try to get the current lease
          // In a real app, you'd have a better way to link user to tenant/lease
          if (invoicesData.length > 0 && invoicesData[0].leaseId) {
            const leaseData = await leaseService.get(invoicesData[0].leaseId);
            setLease(leaseData);
          }
        }
      } catch (err) {
        console.error('Error loading payment data:', err);
        setError('Failed to load payment data');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [userProfile, isDemoMode]);
  
  const handlePayInvoice = async (invoice: Invoice) => {
    if (!isStripeConfigured() && !isDemoMode) {
      setError('Stripe is not configured. Please contact support.');
      return;
    }
    
    if (isDemoMode) {
      setError('Payment is disabled in demo mode. Configure Firebase and Stripe to enable payments.');
      return;
    }
    
    try {
      setPaymentLoading(invoice.id);
      setError(null);
      
      await redirectToCheckout({
        type: invoice.type as 'rent' | 'deposit' | 'fee' | 'late_fee' | 'application_fee',
        amount: invoice.amountCents,
        description: invoice.description,
        invoiceId: invoice.id,
        leaseId: invoice.leaseId,
      });
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate payment');
      setPaymentLoading(null);
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
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed':
        return (
          <span className="badge badge-success">
            <CheckCircle size={14} />
            Paid
          </span>
        );
      case 'due':
        return (
          <span className="badge badge-warning">
            <Clock size={14} />
            Due
          </span>
        );
      case 'overdue':
        return (
          <span className="badge badge-error">
            <AlertCircle size={14} />
            Overdue
          </span>
        );
      case 'pending':
      case 'processing':
        return (
          <span className="badge badge-info">
            <Clock size={14} />
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="badge badge-error">
            <XCircle size={14} />
            Failed
          </span>
        );
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };
  
  // Calculate totals
  const totalDue = invoices
    .filter(inv => inv.status === 'due' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.amountCents, 0);
  
  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);
  
  if (loading) {
    return (
      <div className="page tenant-payments-page">
        <div className="loading-container">
          <Loader2 className="loading-spinner" size={48} />
          <p>Loading payment information...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="page tenant-payments-page">
      <div className="page-header">
        <div>
          <h1>Payments</h1>
          <p>View and pay your rent, deposits, and fees</p>
        </div>
      </div>
      
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle size={18} />
          {successMessage}
          <button onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}
      
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      {/* Demo Mode Notice */}
      {isDemoMode && (
        <div className="alert alert-info">
          <AlertCircle size={18} />
          Demo Mode: Payment processing is simulated. Configure Firebase and Stripe to enable real payments.
        </div>
      )}
      
      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card outstanding">
          <div className="summary-icon">
            <DollarSign size={24} />
          </div>
          <div className="summary-content">
            <h3>Amount Due</h3>
            <div className="summary-amount">{formatCurrency(totalDue)}</div>
          </div>
        </div>
        
        <div className="summary-card paid">
          <div className="summary-icon">
            <CheckCircle size={24} />
          </div>
          <div className="summary-content">
            <h3>Total Paid</h3>
            <div className="summary-amount">{formatCurrency(totalPaid)}</div>
          </div>
        </div>
        
        {lease && (
          <div className="summary-card rent">
            <div className="summary-icon">
              <Calendar size={24} />
            </div>
            <div className="summary-content">
              <h3>Monthly Rent</h3>
              <div className="summary-amount">{formatCurrency(lease.monthlyRent * 100)}</div>
              <span className="summary-note">Due on the {lease.rentDueDay}st</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Outstanding Invoices */}
      <section className="payments-section">
        <h2>
          <CreditCard size={20} />
          Outstanding Invoices
        </h2>
        
        {invoices.filter(inv => inv.status === 'due' || inv.status === 'overdue').length > 0 ? (
          <div className="invoices-list">
            {invoices
              .filter(inv => inv.status === 'due' || inv.status === 'overdue')
              .map(invoice => (
                <div key={invoice.id} className={`invoice-card ${invoice.status}`}>
                  <div className="invoice-info">
                    <div className="invoice-header">
                      <h3>{invoice.description}</h3>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <div className="invoice-details">
                      <span className="invoice-type">{invoice.type}</span>
                      <span className="invoice-due">
                        <Calendar size={14} />
                        Due {formatDate(invoice.dueDate)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="invoice-action">
                    <div className="invoice-amount">
                      {formatCurrency(invoice.amountCents)}
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => handlePayInvoice(invoice)}
                      disabled={paymentLoading === invoice.id}
                    >
                      {paymentLoading === invoice.id ? (
                        <>
                          <Loader2 className="spinner" size={16} />
                          Processing...
                        </>
                      ) : (
                        <>
                          Pay Now
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="empty-state">
            <CheckCircle size={48} className="text-success" />
            <h3>All Caught Up!</h3>
            <p>You have no outstanding invoices.</p>
          </div>
        )}
      </section>
      
      {/* Payment History */}
      <section className="payments-section">
        <h2>
          <Clock size={20} />
          Payment History
        </h2>
        
        {payments.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(payment => (
                  <tr key={payment.id}>
                    <td>{payment.paidDate ? formatDate(payment.paidDate) : formatDate(payment.createdAt)}</td>
                    <td>{payment.type === 'rent' ? `${getMonthName(payment.dueDate)} Rent` : formatPaymentType(payment.type)}</td>
                    <td><span className="badge badge-gray">{formatPaymentType(payment.type)}</span></td>
                    <td>
                      {payment.method === 'stripe' ? (
                        <span className="payment-method">
                          <CreditCard size={14} />
                          Card
                        </span>
                      ) : (
                        payment.method
                      )}
                    </td>
                    <td className="amount">{formatCurrency(payment.amount)}</td>
                    <td>{getStatusBadge(payment.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Clock size={48} />
            <h3>No Payment History</h3>
            <p>Your payment history will appear here after you make payments.</p>
          </div>
        )}
      </section>
      
      {/* Stripe Notice */}
      {isStripeConfigured() && (
        <div className="stripe-notice">
          <ExternalLink size={14} />
          Payments are securely processed by Stripe. Your card information is never stored on our servers.
        </div>
      )}
    </div>
  );
}

function getMonthName(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatPaymentType(type: string): string {
  const types: Record<string, string> = {
    rent: 'Rent',
    deposit: 'Deposit',
    fee: 'Fee',
    late_fee: 'Late Fee',
    application_fee: 'Application Fee',
    other: 'Other',
  };
  return types[type] || type;
}
