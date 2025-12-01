import { useAuth } from '../../contexts';
import {
  Home,
  CreditCard,
  FileText,
  Wrench,
  ArrowRight,
  DollarSign,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './TenantDashboard.css';

export function TenantDashboard() {
  const { userProfile } = useAuth();

  // Placeholder data - would come from Firestore
  const dashboardData = {
    nextRentDue: {
      amount: 1500,
      dueDate: new Date(new Date().setDate(1)),
    },
    leaseEndDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
    openTickets: 0,
    currentBalance: 0,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const daysUntilDue = Math.ceil((dashboardData.nextRentDue.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="tenant-dashboard">
      <div className="page-header">
        <div>
          <h1>Welcome, {userProfile?.displayName?.split(' ')[0] || 'Tenant'}!</h1>
          <p>Here's an overview of your account</p>
        </div>
      </div>

      {/* Main Cards */}
      <div className="dashboard-cards">
        {/* Rent Due Card */}
        <div className="dashboard-card rent-card">
          <div className="card-icon">
            <DollarSign size={24} />
          </div>
          <div className="card-content">
            <h3>Next Rent Due</h3>
            <div className="rent-amount">{formatCurrency(dashboardData.nextRentDue.amount)}</div>
            <p className="due-date">
              Due {formatDate(dashboardData.nextRentDue.dueDate)}
              {daysUntilDue > 0 && <span className="days-left"> ({daysUntilDue} days)</span>}
            </p>
          </div>
          <Link to="/tenant/payments" className="btn btn-primary">
            Pay Now
          </Link>
        </div>

        {/* Lease Card */}
        <div className="dashboard-card">
          <div className="card-icon lease-icon">
            <FileText size={24} />
          </div>
          <div className="card-content">
            <h3>Lease End Date</h3>
            <div className="card-value">{formatDate(dashboardData.leaseEndDate)}</div>
          </div>
          <Link to="/tenant/lease" className="card-link">
            View Lease <ArrowRight size={14} />
          </Link>
        </div>

        {/* Maintenance Card */}
        <div className="dashboard-card">
          <div className="card-icon maintenance-icon">
            <Wrench size={24} />
          </div>
          <div className="card-content">
            <h3>Open Tickets</h3>
            <div className="card-value">{dashboardData.openTickets}</div>
          </div>
          <Link to="/tenant/maintenance" className="card-link">
            {dashboardData.openTickets > 0 ? 'View Tickets' : 'Submit Request'} <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <section className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions">
          <Link to="/tenant/payments" className="quick-action">
            <CreditCard size={24} />
            <span>Pay Rent</span>
          </Link>
          <Link to="/tenant/lease" className="quick-action">
            <FileText size={24} />
            <span>View Lease</span>
          </Link>
          <Link to="/tenant/maintenance" className="quick-action">
            <Wrench size={24} />
            <span>Submit Maintenance</span>
          </Link>
        </div>
      </section>

      {/* Property Info */}
      <section className="dashboard-section">
        <h2>My Home</h2>
        <div className="property-info-card">
          <div className="property-image-placeholder">
            <Home size={48} />
          </div>
          <div className="property-details">
            <h3>Your Rental Property</h3>
            <p>Property details will appear here when linked to a lease.</p>
            <Link to="/tenant/lease" className="btn btn-secondary btn-sm">
              View Details
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
