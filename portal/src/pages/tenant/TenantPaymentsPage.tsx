import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../contexts';
import { createCheckoutSession, isStripeConfigured } from '../../lib/stripe';
import { getRentStatement, getRentStatements } from '../../lib/api/portalApi';
import type { RentStatement } from '../../types';
import './TenantPaymentsPage.css';

interface LedgerItem {
  id: string;
  amountCents: number;
  label: string;
  type: string;
  effectiveDate: string;
}

export function TenantPaymentsPage() {
  const { userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statements, setStatements] = useState<RentStatement[]>([]);
  const [ledgerByStatement, setLedgerByStatement] = useState<Record<string, LedgerItem[]>>({});
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const canceled = searchParams.get('canceled');

    if (sessionId) {
      setSuccessMessage('Payment submitted successfully. Ledger will update after Stripe confirmation.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled) {
      setError('Payment was canceled.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      if (!userProfile) return;

      try {
        setLoading(true);
        setError(null);

        const response = await getRentStatements();
        const loadedStatements = response.statements || [];
        setStatements(loadedStatements);

        const openStatement = loadedStatements.find((statement) => statement.status === 'open');
        if (openStatement) {
          const statementDetail = await getRentStatement(openStatement.id);
          setLedgerByStatement((previous) => ({
            ...previous,
            [openStatement.id]: statementDetail.ledger || [],
          }));
        }
      } catch (loadError) {
        console.error('Error loading tenant payments:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load payment data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userProfile]);

  const currentStatement = useMemo(() => {
    const open = statements.filter((statement) => statement.status === 'open' && statement.balanceCents > 0);
    return open.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0] || null;
  }, [statements]);

  const paymentHistory = useMemo(() => {
    const entries: Array<LedgerItem & { month: string }> = [];
    Object.entries(ledgerByStatement).forEach(([statementId, ledger]) => {
      const statement = statements.find((item) => item.id === statementId);
      const month = statement?.month || '';
      ledger.forEach((entry) => {
        if (entry.type === 'payment' || entry.amountCents < 0) {
          entries.push({ ...entry, month });
        }
      });
    });
    return entries.sort((a, b) => String(b.effectiveDate).localeCompare(String(a.effectiveDate)));
  }, [ledgerByStatement, statements]);

  const totalDue = statements
    .filter((statement) => statement.status === 'open')
    .reduce((sum, statement) => sum + statement.balanceCents, 0);

  const totalPaid = paymentHistory.reduce((sum, entry) => sum + Math.abs(entry.amountCents), 0);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const formatDate = (value: string | Date) =>
    new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatMonth = (month: string) => {
    const [year, mo] = month.split('-');
    return new Date(Number(year), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handlePayRent = async (statement: RentStatement) => {
    if (!isStripeConfigured()) {
      setError('Stripe is not configured. Please contact support.');
      return;
    }

    const customAmount = payAmounts[statement.id];
    const amountCents = customAmount ? Math.round(Number(customAmount) * 100) : statement.balanceCents;

    if (!Number.isFinite(amountCents) || amountCents < 100) {
      setError('Minimum payment is $1.00');
      return;
    }

    if (amountCents > statement.balanceCents) {
      setError(`Maximum payment is ${formatCurrency(statement.balanceCents)}`);
      return;
    }

    try {
      setPaymentLoading(statement.id);
      setError(null);
      const session = await createCheckoutSession({
        type: 'rent',
        statementId: statement.id,
        amountCents,
        description: `Rent Payment - ${formatMonth(statement.month)}`,
      });
      window.location.href = session.url;
    } catch (paymentError) {
      console.error('Failed to start payment:', paymentError);
      setError(paymentError instanceof Error ? paymentError.message : 'Failed to initiate payment');
      setPaymentLoading(null);
    }
  };

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

  if (!userProfile?.currentLeaseId) {
    return (
      <div className="page tenant-payments-page">
        <div className="page-header">
          <div>
            <h1>Payments</h1>
            <p>No lease assigned. Contact management.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page tenant-payments-page">
      <div className="page-header">
        <div>
          <h1>Payments</h1>
          <p>Rent statements, ledger, and payment history</p>
        </div>
      </div>

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

      <div className="summary-cards">
        <div className="summary-card outstanding">
          <div className="summary-icon"><DollarSign size={24} /></div>
          <div className="summary-content">
            <h3>Amount Due</h3>
            <div className="summary-amount">{formatCurrency(totalDue)}</div>
          </div>
        </div>
        <div className="summary-card paid">
          <div className="summary-icon"><CheckCircle size={24} /></div>
          <div className="summary-content">
            <h3>Total Paid</h3>
            <div className="summary-amount">{formatCurrency(totalPaid)}</div>
          </div>
        </div>
        <div className="summary-card rent">
          <div className="summary-icon"><Calendar size={24} /></div>
          <div className="summary-content">
            <h3>Policy</h3>
            <div className="summary-amount">Rent due on the 1st</div>
            <span className="summary-note">Late fees start on the 5th: $25 + $10/day</span>
          </div>
        </div>
      </div>

      <section className="payments-section">
        <h2><CreditCard size={20} /> Current Statement</h2>

        {currentStatement ? (
          <div className="invoice-card due">
            <div className="invoice-info">
              <div className="invoice-header">
                <h3>{formatMonth(currentStatement.month)}</h3>
                <span className="badge badge-warning"><Clock size={14} /> Open</span>
              </div>
              <div className="invoice-details">
                <span className="invoice-type">Rent Statement</span>
                <span className="invoice-due"><Calendar size={14} /> Due {formatDate(currentStatement.dueDate)}</span>
              </div>
            </div>
            <div className="invoice-action">
              <div className="invoice-amount">{formatCurrency(currentStatement.balanceCents)}</div>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="Optional partial amount"
                value={payAmounts[currentStatement.id] || ''}
                onChange={(event) => setPayAmounts((previous) => ({ ...previous, [currentStatement.id]: event.target.value }))}
              />
              <button
                className="btn btn-primary"
                onClick={() => handlePayRent(currentStatement)}
                disabled={paymentLoading === currentStatement.id}
              >
                {paymentLoading === currentStatement.id ? <><Loader2 className="spinner" size={16} /> Processing...</> : <>Pay Rent <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <CheckCircle size={48} className="text-success" />
            <h3>No Open Balance</h3>
            <p>You have no open statement balance right now.</p>
          </div>
        )}
      </section>

      <section className="payments-section">
        <h2><Clock size={20} /> Payment History</h2>
        {paymentHistory.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Month</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.effectiveDate)}</td>
                    <td>{entry.month ? formatMonth(entry.month) : '-'}</td>
                    <td>{entry.label}</td>
                    <td className="amount">{formatCurrency(Math.abs(entry.amountCents))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Clock size={48} />
            <h3>No Payment History</h3>
            <p>Payments will appear after successful processing.</p>
          </div>
        )}
      </section>

      {isStripeConfigured() && (
        <div className="stripe-notice">
          <ExternalLink size={14} />
          Payments are securely processed by Stripe.
        </div>
      )}
    </div>
  );
}
