import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../../contexts';
import { rentStatementService, ledgerService, isFirebaseConfigured } from '../../lib/firebase';
import { createCheckoutSession, isStripeConfigured } from '../../lib/stripe';
import type { RentStatement, LedgerEntry } from '../../types';
import './TenantRentHistory.css';

// Demo data for when Firebase is not configured
const DEMO_STATEMENTS: RentStatement[] = [
  {
    id: 'demo-stmt-2026-02',
    leaseId: 'demo-lease-001',
    tenantUid: 'demo-tenant-001',
    month: '2026-02',
    status: 'open',
    dueDate: '2026-02-01',
    rentChargeCents: 150000,
    balanceCents: 150000,
    lateFeesEnabled: true,
    lateFeesThroughDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'demo-stmt-2026-01',
    leaseId: 'demo-lease-001',
    tenantUid: 'demo-tenant-001',
    month: '2026-01',
    status: 'paid',
    dueDate: '2026-01-01',
    rentChargeCents: 150000,
    balanceCents: 0,
    lateFeesEnabled: true,
    lateFeesThroughDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    paidAt: new Date(2025, 11, 30),
  },
];

const DEMO_LEDGER: Record<string, LedgerEntry[]> = {
  'demo-stmt-2026-02': [
    {
      id: 'rent-charge-2026-02',
      type: 'charge',
      label: 'February 2026 Rent',
      amountCents: 150000,
      effectiveDate: '2026-02-01',
      createdByUid: 'system',
      createdAt: new Date(),
    },
  ],
  'demo-stmt-2026-01': [
    {
      id: 'rent-charge-2026-01',
      type: 'charge',
      label: 'January 2026 Rent',
      amountCents: 150000,
      effectiveDate: '2026-01-01',
      createdByUid: 'system',
      createdAt: new Date(),
    },
    {
      id: 'payment-2026-01',
      type: 'payment',
      label: 'Payment',
      amountCents: -150000,
      effectiveDate: '2025-12-30',
      createdByUid: 'demo-tenant-001',
      createdAt: new Date(),
    },
  ],
};

export function TenantRentHistoryPage() {
  const { user, userProfile, isDemoMode } = useAuth();
  const [searchParams] = useSearchParams();
  const [statements, setStatements] = useState<RentStatement[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Record<string, LedgerEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});

  // Check URL params for payment status
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const canceled = searchParams.get('canceled');
    if (sessionId) {
      setSuccessMessage('Payment successful! Your balance will update shortly.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled) {
      setError('Payment was canceled.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  useEffect(() => {
    loadStatements();
  }, [userProfile, isDemoMode]);

  const loadStatements = async () => {
    if (!userProfile) return;
    try {
      setLoading(true);
      setError(null);

      if (isDemoMode || !isFirebaseConfigured) {
        setStatements(DEMO_STATEMENTS);
        setLedgerMap(DEMO_LEDGER);
      } else {
        // Use server API to get statements (which applies late fees)
        const token = user ? await user.getIdToken() : null;
        if (token) {
          const res = await fetch('/api/statements', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setStatements(data.statements || []);
          } else {
            // Fallback to direct Firestore read
            const data = await rentStatementService.getByTenantUid(userProfile.uid);
            setStatements(data);
          }
        } else {
          const data = await rentStatementService.getByTenantUid(userProfile.uid);
          setStatements(data);
        }
      }
    } catch (err) {
      console.error('Error loading statements:', err);
      setError('Failed to load rent history');
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (statementId: string) => {
    if (ledgerMap[statementId]) return;
    if (isDemoMode || !isFirebaseConfigured) return;

    try {
      // Try server API first for late-fee-enriched data
      const token = user ? await user.getIdToken() : null;
      if (token) {
        const res = await fetch(`/api/statements?statementId=${statementId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLedgerMap(prev => ({ ...prev, [statementId]: data.ledger || [] }));
          // Update statement with potentially refreshed data
          if (data.statement) {
            setStatements(prev =>
              prev.map(s => (s.id === statementId ? { ...s, ...data.statement } : s))
            );
          }
          return;
        }
      }
      // Fallback to direct Firestore
      const entries = await ledgerService.getByStatement(statementId);
      setLedgerMap(prev => ({ ...prev, [statementId]: entries }));
    } catch (err) {
      console.error('Error loading ledger:', err);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadLedger(id);
    }
  };

  const handlePay = async (statement: RentStatement) => {
    if (!isStripeConfigured() && !isDemoMode) {
      setError('Stripe is not configured. Please contact help@laneandkey.com.');
      return;
    }
    if (isDemoMode) {
      setError('Payment is disabled in demo mode.');
      return;
    }

    const inputAmount = payAmounts[statement.id];
    const amountCents = inputAmount
      ? Math.round(parseFloat(inputAmount) * 100)
      : statement.balanceCents;

    if (isNaN(amountCents) || amountCents < 100) {
      setError('Minimum payment is $1.00');
      return;
    }
    if (amountCents > statement.balanceCents) {
      setError(`Maximum payment is ${formatCurrency(statement.balanceCents)}`);
      return;
    }

    try {
      setPayingId(statement.id);
      setError(null);
      const session = await createCheckoutSession({
        type: 'rent',
        amountCents,
        statementId: statement.id,
        description: `Rent Payment - ${formatMonth(statement.month)}`,
      });
      window.location.href = session.url;
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start payment');
      setPayingId(null);
    }
  };

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const formatMonth = (month: string) => {
    const [y, m] = month.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const totalDue = statements
    .filter(s => s.status === 'open' && s.balanceCents > 0)
    .reduce((sum, s) => sum + s.balanceCents, 0);

  if (loading) {
    return (
      <div className="page rent-history-page">
        <div className="loading-container">
          <Loader2 className="loading-spinner" size={48} />
          <p>Loading rent history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page rent-history-page">
      <div className="page-header">
        <div>
          <h1>Rent History</h1>
          <p>View monthly statements, fees, and make payments</p>
        </div>
      </div>

      {/* Messages */}
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
      {isDemoMode && (
        <div className="alert alert-info">
          <AlertCircle size={18} />
          Demo Mode: Showing sample data. Configure Firebase to view real statements.
        </div>
      )}

      {/* Summary Card */}
      <div className="rent-summary">
        <div className="summary-card outstanding">
          <div className="summary-icon">
            <DollarSign size={24} />
          </div>
          <div className="summary-content">
            <h3>Total Outstanding</h3>
            <div className={`summary-amount ${totalDue > 0 ? 'text-red' : 'text-green'}`}>
              {formatCurrency(totalDue)}
            </div>
          </div>
        </div>
      </div>

      {/* Statements List */}
      <section className="statements-section">
        <h2><Receipt size={20} /> Monthly Statements</h2>

        {statements.length === 0 ? (
          <div className="empty-state">
            <Calendar size={48} />
            <h3>No Statements</h3>
            <p>Your rent statements will appear here once your lease is active.</p>
          </div>
        ) : (
          <div className="statements-list">
            {statements.map(stmt => {
              const isOpen = stmt.status === 'open' && stmt.balanceCents > 0;
              const isPaid = stmt.status === 'paid' || stmt.balanceCents <= 0;
              const isExpanded = expandedId === stmt.id;
              const entries = ledgerMap[stmt.id] || [];

              return (
                <div
                  key={stmt.id}
                  className={`statement-card ${isOpen ? 'status-open' : ''} ${isPaid ? 'status-paid' : ''}`}
                >
                  {/* Statement header row */}
                  <div className="statement-header" onClick={() => toggleExpand(stmt.id)}>
                    <div className="statement-month">
                      <Calendar size={18} />
                      <h3>{formatMonth(stmt.month)}</h3>
                    </div>
                    <div className="statement-info">
                      <div className="statement-rent">
                        Rent: {formatCurrency(stmt.rentChargeCents)}
                      </div>
                      <div className={`statement-balance ${isOpen ? 'text-red' : 'text-green'}`}>
                        Balance: {formatCurrency(stmt.balanceCents)}
                      </div>
                      <div className="statement-status">
                        {isPaid ? (
                          <span className="badge badge-success">
                            <CheckCircle size={14} /> Paid
                          </span>
                        ) : (
                          <span className="badge badge-error">
                            <Clock size={14} /> Open
                          </span>
                        )}
                      </div>
                    </div>
                    <button className="expand-btn">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>

                  {/* Expanded: Ledger + Payment */}
                  {isExpanded && (
                    <div className="statement-detail">
                      {/* Ledger table */}
                      <div className="ledger-section">
                        <h4>Transaction History</h4>
                        {entries.length > 0 ? (
                          <table className="ledger-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Type</th>
                                <th className="text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entries.map(entry => (
                                <tr key={entry.id} className={`ledger-row type-${entry.type}`}>
                                  <td>{entry.effectiveDate}</td>
                                  <td>{entry.label}</td>
                                  <td>
                                    <span className={`badge badge-${getLedgerBadge(entry.type)}`}>
                                      {entry.type}
                                    </span>
                                  </td>
                                  <td className={`text-right ${entry.amountCents < 0 ? 'text-green' : 'text-red'}`}>
                                    {entry.amountCents < 0 ? '-' : '+'}{formatCurrency(Math.abs(entry.amountCents))}
                                  </td>
                                </tr>
                              ))}
                              <tr className="ledger-total">
                                <td colSpan={3}><strong>Current Balance</strong></td>
                                <td className={`text-right ${stmt.balanceCents > 0 ? 'text-red' : 'text-green'}`}>
                                  <strong>{formatCurrency(stmt.balanceCents)}</strong>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-muted">Loading transactions...</p>
                        )}
                      </div>

                      {/* Payment form (only for open statements) */}
                      {isOpen && (
                        <div className="payment-section">
                          <h4>Make a Payment</h4>
                          <div className="payment-form">
                            <div className="payment-input-group">
                              <label>Payment Amount</label>
                              <div className="input-with-prefix">
                                <span className="prefix">$</span>
                                <input
                                  type="number"
                                  min="1"
                                  max={(stmt.balanceCents / 100).toFixed(2)}
                                  step="0.01"
                                  placeholder={(stmt.balanceCents / 100).toFixed(2)}
                                  value={payAmounts[stmt.id] || ''}
                                  onChange={e =>
                                    setPayAmounts(prev => ({
                                      ...prev,
                                      [stmt.id]: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <span className="input-hint">
                                Min $1.00 · Max {formatCurrency(stmt.balanceCents)} (full balance)
                              </span>
                            </div>
                            <button
                              className="btn btn-primary pay-btn"
                              disabled={payingId === stmt.id}
                              onClick={() => handlePay(stmt)}
                            >
                              {payingId === stmt.id ? (
                                <>
                                  <Loader2 className="spinner" size={16} /> Processing...
                                </>
                              ) : (
                                <>
                                  <CreditCard size={16} />
                                  {payAmounts[stmt.id]
                                    ? `Pay $${parseFloat(payAmounts[stmt.id]).toFixed(2)}`
                                    : `Pay Full Balance ${formatCurrency(stmt.balanceCents)}`}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function getLedgerBadge(type: string): string {
  switch (type) {
    case 'charge': return 'gray';
    case 'fee': return 'warning';
    case 'payment': return 'success';
    case 'credit': return 'info';
    case 'adjustment': return 'info';
    default: return 'gray';
  }
}
