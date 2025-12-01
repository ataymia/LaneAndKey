import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle,
  MessageSquare,
} from 'lucide-react';
import { maintenanceService } from '../../lib/firebase';
import type { MaintenanceTicket } from '../../types';
import './Maintenance.css';

export function MaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const data = await maintenanceService.getAll();
      setTickets(data);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = statusFilter === 'all'
    ? tickets
    : tickets.filter(t => t.status === statusFilter);

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      emergency: 'error',
      high: 'warning',
      medium: 'info',
      low: 'gray',
    };
    return <span className={`badge badge-${colors[priority] || 'gray'}`}>{priority}</span>;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      new: 'info',
      in_progress: 'warning',
      waiting: 'gray',
      completed: 'success',
      archived: 'gray',
    };
    return <span className={`badge badge-${colors[status] || 'gray'}`}>{status.replace('_', ' ')}</span>;
  };

  return (
    <div className="maintenance-page">
      <div className="page-header">
        <div>
          <h1>Maintenance</h1>
          <p>{tickets.length} total tickets</p>
        </div>
        <button className="btn btn-primary">
          <Plus size={18} />
          New Ticket
        </button>
      </div>

      {/* Status Summary */}
      <div className="status-summary">
        <div className="status-card" onClick={() => setStatusFilter('new')}>
          <div className="status-icon new">
            <AlertTriangle size={20} />
          </div>
          <div className="status-count">{tickets.filter(t => t.status === 'new').length}</div>
          <div className="status-label">New</div>
        </div>
        <div className="status-card" onClick={() => setStatusFilter('in_progress')}>
          <div className="status-icon in-progress">
            <Clock size={20} />
          </div>
          <div className="status-count">{tickets.filter(t => t.status === 'in_progress').length}</div>
          <div className="status-label">In Progress</div>
        </div>
        <div className="status-card" onClick={() => setStatusFilter('completed')}>
          <div className="status-icon completed">
            <CheckCircle size={20} />
          </div>
          <div className="status-count">{tickets.filter(t => t.status === 'completed').length}</div>
          <div className="status-label">Completed</div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search tickets..." />
        </div>
        <div className="filter-group">
          <Filter size={16} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="filter-group">
          <select>
            <option value="all">All Priority</option>
            <option value="emergency">Emergency</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {filteredTickets.length > 0 ? (
        <div className="tickets-list">
          {filteredTickets.map(ticket => (
            <div key={ticket.id} className="ticket-card">
              <div className="ticket-header">
                <div className="ticket-info">
                  <h3>#{ticket.id.slice(0, 8)} - {ticket.category}</h3>
                  <p className="ticket-description">{ticket.description}</p>
                </div>
                <div className="ticket-badges">
                  {getPriorityBadge(ticket.priority)}
                  {getStatusBadge(ticket.status)}
                </div>
              </div>
              <div className="ticket-footer">
                <div className="ticket-meta">
                  <span>Property: {ticket.propertyId.slice(0, 8)}...</span>
                  {ticket.tenantId && <span>Tenant: {ticket.tenantId.slice(0, 8)}...</span>}
                  <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="ticket-actions">
                  {ticket.comments && ticket.comments.length > 0 && (
                    <span className="comment-count">
                      <MessageSquare size={14} />
                      {ticket.comments.length}
                    </span>
                  )}
                  <Link to={`/admin/maintenance/${ticket.id}`} className="btn btn-sm btn-outline">
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Wrench size={32} />
          </div>
          <h3 className="empty-state-title">No maintenance tickets</h3>
          <p className="empty-state-description">
            {statusFilter !== 'all'
              ? 'No tickets match this filter'
              : 'Maintenance requests will appear here'}
          </p>
        </div>
      )}
    </div>
  );
}
