import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts';
import {
  Home,
  CreditCard,
  FileText,
  Wrench,
  ArrowRight,
  DollarSign,
  Pen,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { leaseService, maintenanceService, propertyService, rentStatementService } from '../../lib/firebase';
import { generatedLeaseService } from '../../lib/firebase/firestore';
import type { Lease, Property, RentStatement, GeneratedLease } from '../../types';
import './TenantDashboard.css';

export function TenantDashboard() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [statements, setStatements] = useState<RentStatement[]>([]);
  const [openTickets, setOpenTickets] = useState(0);
  const [pendingLease, setPendingLease] = useState<GeneratedLease | null>(null);
  const [allVoided, setAllVoided] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!userProfile) return;
      try {
        setLoading(true);
        setError(null);

        let currentLease: Lease | null = null;
        if (userProfile.currentLeaseId) {
          currentLease = await leaseService.get(userProfile.currentLeaseId);
        }

        if (!currentLease) {
          const leases = await leaseService.getByTenant(userProfile.uid);
          currentLease = leases.find((l) => l.status === 'active' || l.status === 'pending') || null;
        }

        setLease(currentLease);

        if (currentLease?.propertyId) {
          const propertyData = await propertyService.get(currentLease.propertyId);
          setProperty(propertyData);
        }

        const [statementData, maintenanceData] = await Promise.all([
          rentStatementService.getByTenantUid(userProfile.uid).catch((err) => {
            console.warn('Failed to load rent statements:', err);
            return [] as RentStatement[];
          }),
          maintenanceService.getByTenant(userProfile.uid).catch((err) => {
            console.warn('Failed to load maintenance tickets:', err);
            return [];
          }),
        ]);

        setStatements(statementData);
        setOpenTickets(maintenanceData.filter((ticket) => ticket.status !== 'completed').length);

        // Check for pending lease to sign or voided leases
        try {
          const genLeases = await generatedLeaseService.getByTenant(userProfile.uid);
          const pending = genLeases.find(
            (g) => g.signingStatus === 'sent' || g.signingStatus === 'viewed'
          );
          setPendingLease(pending || null);

          // If there are generated leases but all are voided, let tenant know
          if (!pending && genLeases.length > 0 && genLeases.every(
            (g) => g.signingStatus === 'voided'
          )) {
            setAllVoided(true);
          }
        } catch (glErr) {
          console.warn('Failed to check generated leases:', glErr);
        }
      } catch (loadError) {
        console.error('Error loading tenant dashboard data:', loadError);
        setError('Failed to load your dashboard. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userProfile]);

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

  const currentStatement = useMemo(() => {
    const openStatements = statements.filter((statement) => statement.status === 'open' && statement.balanceCents > 0);
    return openStatements.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0] || null;
  }, [statements]);

  const currentBalance = useMemo(() => {
    return statements
      .filter((statement) => statement.status === 'open')
      .reduce((sum, statement) => sum + statement.balanceCents, 0);
  }, [statements]);

  if (loading) {
    return <div className="tenant-dashboard"><div className="loading-state">Loading dashboard...</div></div>;
  }

  if (error) {
    return <div className="tenant-dashboard"><div className="error-state">{error}</div></div>;
  }

  if (!lease) {
    return (
      <div className="tenant-dashboard">
        <div className="page-header">
          <div>
            <h1>Welcome, {userProfile?.displayName?.split(' ')[0] || 'Tenant'}!</h1>
            <p>No lease assigned. Contact management.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tenant-dashboard">
      <div className="page-header">
        <div>
          <h1>Welcome, {userProfile?.displayName?.split(' ')[0] || 'Tenant'}!</h1>
          <p>Here's an overview of your account</p>
        </div>
      </div>

      {/* Lease signing banner */}
      {pendingLease && (
        <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: '0.5rem', background: '#fef3cd', border: '1px solid #ffc107' }}>
          <Pen size={20} />
          <div style={{ flex: 1 }}>
            <strong>You have a lease to sign.</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Your property manager has sent a lease agreement for your review and signature.</p>
          </div>
          <Link to="/tenant/lease" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
            Review &amp; Sign
          </Link>
        </div>
      )}

      {/* Voided lease banner */}
      {allVoided && !pendingLease && (
        <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: '0.5rem', background: '#e8f4fd', border: '1px solid #bee5eb' }}>
          <AlertCircle size={20} />
          <div style={{ flex: 1 }}>
            <strong>Lease update in progress</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Your previous lease was voided. Your property manager is preparing an updated lease — you'll be notified when it's ready to sign.</p>
          </div>
        </div>
      )}

      {/* Main Cards */}
      <div className="dashboard-cards">
        {/* Rent Due Card */}
        <div className="dashboard-card rent-card">
          <div className="card-icon">
            <DollarSign size={24} />
          </div>
          <div className="card-content">
            <h3>Next Rent Due</h3>
            <div className="rent-amount">{formatCurrency((currentStatement?.balanceCents || 0) / 100)}</div>
            <p className="due-date">{currentStatement ? `Due ${formatDate(new Date(currentStatement.dueDate))}` : 'No open statement'}</p>
          </div>
          <Link to="/tenant/payments" className="btn btn-primary">
            Pay
          </Link>
        </div>

        {/* Lease Card */}
        <div className="dashboard-card">
          <div className="card-icon lease-icon">
            <FileText size={24} />
          </div>
          <div className="card-content">
            <h3>Lease End Date</h3>
            <div className="card-value">{lease.endDate ? formatDate(new Date(lease.endDate)) : 'Open-ended'}</div>
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
            <div className="card-value">{openTickets}</div>
          </div>
          <Link to="/tenant/maintenance" className="card-link">
            {openTickets > 0 ? 'View Tickets' : 'Submit Request'} <ArrowRight size={14} />
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
            <h3>{property?.address || 'Assigned Property'}</h3>
            <p>{property ? `${property.city}, ${property.state} ${property.zip}` : 'Property details unavailable.'}</p>
            <p>Current Balance: <strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(currentBalance / 100)}</strong></p>
            <Link to="/tenant/lease" className="btn btn-secondary btn-sm">
              View Details
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
