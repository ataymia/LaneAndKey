import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  Send,
  Loader2,
  User,
  MapPin,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../../contexts';
import { maintenanceService, propertyService } from '../../lib/firebase';
import type { MaintenanceTicket, MaintenanceStatus, Property } from '../../types';
import './Maintenance.css';

export function MaintenanceDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<MaintenanceTicket | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Comment
  const [comment, setComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  useEffect(() => {
    loadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function loadTicket() {
    if (!ticketId) return;
    setLoading(true);
    try {
      const t = await maintenanceService.get(ticketId);
      if (!t) {
        setError('Ticket not found.');
        return;
      }
      setTicket(t);
      if (t.propertyId) {
        const p = await propertyService.get(t.propertyId);
        setProperty(p);
      }
    } catch (err) {
      console.error('Error loading ticket:', err);
      setError('Failed to load ticket.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: MaintenanceStatus) {
    if (!ticket) return;
    setUpdatingStatus(true);
    try {
      await maintenanceService.update(ticket.id, { status: newStatus });
      setTicket({ ...ticket, status: newStatus });
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !comment.trim() || !user) return;
    setAddingComment(true);
    try {
      const newComment = {
        id: `c_${Date.now()}`,
        userId: user.uid,
        userRole: 'admin' as const,
        content: comment.trim(),
        createdAt: new Date(),
      };
      await maintenanceService.addComment(ticket.id, newComment);
      setTicket({ ...ticket, comments: [...(ticket.comments || []), newComment] });
      setComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment.');
    } finally {
      setAddingComment(false);
    }
  }

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const priorityClass: Record<string, string> = {
    emergency: 'error', high: 'warning', medium: 'info', low: 'gray',
  };
  const statusClass: Record<string, string> = {
    new: 'info', in_progress: 'warning', waiting: 'gray', completed: 'success', archived: 'gray',
  };

  if (loading) {
    return (
      <div className="maintenance-page">
        <div className="loading-container"><Loader2 size={32} className="spinner" /><p>Loading ticket…</p></div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="maintenance-page">
        <div className="page-header">
          <Link to="/admin/maintenance" className="btn btn-outline"><ArrowLeft size={16} /> Back</Link>
        </div>
        <div className="empty-state">
          <Wrench size={32} />
          <h3>{error || 'Ticket not found'}</h3>
          <button className="btn btn-primary" onClick={() => navigate('/admin/maintenance')}>Return to Maintenance</button>
        </div>
      </div>
    );
  }

  const statuses: MaintenanceStatus[] = ['new', 'in_progress', 'waiting', 'completed', 'archived'];

  return (
    <div className="maintenance-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <Link to="/admin/maintenance" className="btn btn-sm btn-outline" style={{ marginBottom: '0.5rem' }}>
            <ArrowLeft size={14} /> All Tickets
          </Link>
          <h1>#{ticket.id.slice(0, 8)} — {ticket.category}</h1>
          <p>
            <span className={`badge badge-${priorityClass[ticket.priority] || 'gray'}`}>{ticket.priority}</span>
            {' '}
            <span className={`badge badge-${statusClass[ticket.status] || 'gray'}`}>{ticket.status.replace('_', ' ')}</span>
          </p>
        </div>
      </div>

      {/* Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Info Card */}
        <div className="ticket-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={16} className="text-muted" />
              <span>{property ? `${property.address}${property.unit ? ` #${property.unit}` : ''}` : ticket.propertyId.slice(0, 8) + '…'}</span>
            </div>
            {ticket.unit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="text-muted">Unit:</span> {ticket.unit}
              </div>
            )}
            {ticket.tenantId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={16} className="text-muted" />
                <span>Tenant: {ticket.tenantId.slice(0, 12)}…</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} className="text-muted" />
              <span>Created: {fmtDate(ticket.createdAt)}</span>
            </div>
            {ticket.assignedVendor && (
              <div><span className="text-muted">Vendor:</span> {ticket.assignedVendor}</div>
            )}
            {ticket.costEstimate != null && (
              <div><span className="text-muted">Est. Cost:</span> ${ticket.costEstimate.toFixed(2)}</div>
            )}
          </div>
        </div>

        {/* Status Update Card */}
        <div className="ticket-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Update Status</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {statuses.map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${ticket.status === s ? 'btn-primary' : 'btn-outline'}`}
                disabled={updatingStatus || ticket.status === s}
                onClick={() => handleStatusChange(s)}
              >
                {s === 'new' && <AlertTriangle size={14} />}
                {s === 'in_progress' && <Clock size={14} />}
                {s === 'completed' && <CheckCircle size={14} />}
                {' '}{s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="ticket-card" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Description</h3>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ticket.description}</p>
      </div>

      {/* Comments */}
      <div className="ticket-card" style={{ padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>
          <MessageSquare size={18} style={{ marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
          Comments ({ticket.comments?.length || 0})
        </h3>

        {ticket.comments && ticket.comments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {ticket.comments.map((c) => (
              <div key={c.id} style={{
                padding: '0.75rem 1rem',
                background: 'var(--gray-50, #f9fafb)',
                borderRadius: 'var(--radius-md, 8px)',
                borderLeft: `3px solid ${c.userRole === 'admin' ? 'var(--primary, #2563eb)' : 'var(--gray-300, #d1d5db)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  <span>{c.userRole === 'admin' ? 'Admin' : 'Tenant'}</span>
                  <span>{fmtDate(c.createdAt)}</span>
                </div>
                <p style={{ margin: 0 }}>{c.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted" style={{ marginBottom: '1rem' }}>No comments yet.</p>
        )}

        {/* Add Comment Form */}
        <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment…"
            className="form-input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={addingComment || !comment.trim()}>
            <Send size={14} /> {addingComment ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
