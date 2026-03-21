import { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  Calendar,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../contexts';
import { rentStatementService, ledgerService } from '../../lib/firebase/rentStatements';
import { userService } from '../../lib/firebase/firestore';
import type { RentStatement, LedgerEntry } from '../../types';
import './Statements.css';

/* ─────────────── Helpers ─────────────── */
function fmtCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function statusBadge(status: string) {
  switch (status) {
    case 'paid': return <span className="badge badge-success"><CheckCircle size={12} /> Paid</span>;
    case 'void': return <span className="badge badge-gray"><X size={12} /> Void</span>;
    default: return <span className="badge badge-error"><AlertCircle size={12} /> Open</span>;
  }
}

/* ─────────────── Component ─────────────── */
export function StatementsPage() {
  const { user } = useAuth();
  const [statements, setStatements] = useState<(RentStatement & { tenantName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ledgerMap, setLedgerMap] = useState<Record<string, LedgerEntry[]>>({});
  const [ledgerLoading, setLedgerLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Add-fee modal
  const [feeModal, setFeeModal] = useState<{ statementId: string; tenantName: string } | null>(null);
  const [feeLabel, setFeeLabel] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeSubmitting, setFeeSubmitting] = useState(false);

  useEffect(() => {
    loadStatements();
  }, []);

  async function loadStatements() {
    setLoading(true);
    try {
      const data = await rentStatementService.getAll();
      // Enrich with tenant names
      const enriched = await Promise.all(
        data.map(async (s) => {
          try {
            const profile = await userService.get(s.tenantUid);
            return { ...s, tenantName: profile?.displayName || s.tenantUid };
          } catch {
            return { ...s, tenantName: s.tenantUid };
          }
        })
      );
      setStatements(enriched);
    } catch (err) {
      console.error('Error loading statements:', err);
      setStatements([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!ledgerMap[id]) {
      setLedgerLoading(id);
      try {
        const entries = await ledgerService.getByStatement(id);
        setLedgerMap((m) => ({ ...m, [id]: entries }));
      } catch (err) {
        console.error('Error loading ledger:', err);
      } finally {
        setLedgerLoading(null);
      }
    }
  }

  async function handleAddFee() {
    if (!feeModal || !feeLabel.trim() || !feeAmount.trim()) return;
    const cents = Math.round(parseFloat(feeAmount) * 100);
    if (isNaN(cents) || cents <= 0) return;
    setFeeSubmitting(true);
    try {
      // POST to API
      const token = user ? await user.getIdToken() : '';
      const res = await fetch('/api/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          statementId: feeModal.statementId,
          action: 'add_fee',
          label: feeLabel.trim(),
          amountCents: cents,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Refresh
      setFeeModal(null);
      setFeeLabel('');
      setFeeAmount('');
      // Remove cached ledger so it reloads
      setLedgerMap((m) => {
        const copy = { ...m };
        delete copy[feeModal.statementId];
        return copy;
      });
      await loadStatements();
    } catch (err) {
      console.error('Error adding fee:', err);
      alert('Failed to add fee. Check console for details.');
    } finally {
      setFeeSubmitting(false);
    }
  }

  /* ─── Filtered list ─── */
  const filtered = statements.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (s.tenantName || '').toLowerCase().includes(q) ||
        s.month.includes(q) ||
        fmtMonth(s.month).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalOutstanding = filtered.filter((s) => s.status === 'open').reduce((sum, s) => sum + s.balanceCents, 0);

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="statements-page">
        <div className="loading-container">
          <Loader2 size={32} className="spinner" />
          <p>Loading statements…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="statements-page">
      <div className="page-header">
        <div>
          <h1><FileText size={24} /> Rent Statements</h1>
          <p>View and manage tenant rent statements, ledger entries, and fees</p>
        </div>
      </div>

      {/* Summary */}
      <div className="admin-summary-row">
        <div className="summary-card">
          <DollarSign size={20} />
          <div>
            <span className="summary-label">Total Outstanding</span>
            <span className={`summary-amount ${totalOutstanding > 0 ? 'text-red' : 'text-green'}`}>
              {fmtCurrency(totalOutstanding)}
            </span>
          </div>
        </div>
        <div className="summary-card">
          <AlertCircle size={20} />
          <div>
            <span className="summary-label">Open Statements</span>
            <span className="summary-amount">{filtered.filter((s) => s.status === 'open').length}</span>
          </div>
        </div>
        <div className="summary-card">
          <CheckCircle size={20} />
          <div>
            <span className="summary-label">Paid This View</span>
            <span className="summary-amount text-green">{filtered.filter((s) => s.status === 'paid').length}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={16} />
          <input
            placeholder="Search by tenant or month…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <Filter size={16} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>No statements found</h3>
          <p>Adjust filters or create a new statement.</p>
        </div>
      ) : (
        <div className="statements-table-wrap">
          <table className="statements-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Month</th>
                <th>Tenant</th>
                <th>Rent</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <>
                  <tr key={s.id} className={`stmt-row ${expandedId === s.id ? 'expanded' : ''}`} onClick={() => toggleExpand(s.id)}>
                    <td>
                      {expandedId === s.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="cell-month">{fmtMonth(s.month)}</td>
                    <td>{s.tenantName || s.tenantUid}</td>
                    <td>{fmtCurrency(s.rentChargeCents)}</td>
                    <td className={s.balanceCents > 0 ? 'text-red' : 'text-green'}>
                      {fmtCurrency(s.balanceCents)}
                    </td>
                    <td>{statusBadge(s.status)}</td>
                    <td>
                      {s.status === 'open' && (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFeeModal({ statementId: s.id, tenantName: s.tenantName || s.tenantUid });
                          }}
                        >
                          <Plus size={14} /> Add Fee
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr key={`${s.id}-detail`} className="detail-row">
                      <td colSpan={7}>
                        <div className="ledger-detail">
                          <h4>Ledger – {fmtMonth(s.month)}</h4>
                          {ledgerLoading === s.id ? (
                            <div className="loading-inline"><Loader2 size={16} className="spinner" /> Loading…</div>
                          ) : (
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
                                {(ledgerMap[s.id] || []).map((e) => (
                                  <tr key={e.id} className={`ledger-row type-${e.type}`}>
                                    <td>{e.effectiveDate}</td>
                                    <td>{e.label}</td>
                                    <td><span className={`badge badge-${e.type === 'payment' ? 'success' : e.type === 'fee' ? 'warning' : 'info'}`}>{e.type}</span></td>
                                    <td className="text-right">{fmtCurrency(e.amountCents)}</td>
                                  </tr>
                                ))}
                                {(ledgerMap[s.id] || []).length === 0 && (
                                  <tr><td colSpan={4} className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>No ledger entries</td></tr>
                                )}
                                <tr className="ledger-total">
                                  <td colSpan={3}><strong>Balance</strong></td>
                                  <td className={`text-right ${s.balanceCents > 0 ? 'text-red' : 'text-green'}`}><strong>{fmtCurrency(s.balanceCents)}</strong></td>
                                </tr>
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Fee Modal */}
      {feeModal && (
        <div className="modal-overlay" onClick={() => setFeeModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Fee</h3>
              <button className="modal-close" onClick={() => setFeeModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ marginBottom: '1rem' }}>
                Adding fee to statement for <strong>{feeModal.tenantName}</strong>
              </p>
              <div className="form-group">
                <label>Fee Label</label>
                <input
                  type="text"
                  placeholder="e.g. Pet deposit, Parking fee"
                  value={feeLabel}
                  onChange={(e) => setFeeLabel(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="25.00"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setFeeModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={feeSubmitting || !feeLabel.trim() || !feeAmount.trim()}
                onClick={handleAddFee}
              >
                {feeSubmitting ? <><Loader2 size={16} className="spinner" /> Adding…</> : <>Add Fee</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
