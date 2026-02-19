import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts';
import { Link } from 'react-router-dom';
import {
  FileText,
  CheckCircle,
  Clock,
  ArrowRight,
  Search,
  Home,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { applicationService, propertyService } from '../../lib/firebase';
import type { Application, Property } from '../../types';
import './ApplicantDashboard.css';

export function ApplicantDashboard() {
  const { userProfile, user } = useAuth();
  const [applications, setApplications] = useState<(Application & { propertyAddress?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadApplications();
  }, [user]);

  const loadApplications = async () => {
    if (!user) return;
    try {
      const apps = await applicationService.getByApplicant(user.uid);
      // Fetch property addresses
      const enriched = await Promise.all(apps.map(async (app) => {
        try {
          const prop = await propertyService.get(app.propertyId);
          return { ...app, propertyAddress: prop ? `${prop.address}, ${prop.city}` : 'Unknown property' };
        } catch { return { ...app, propertyAddress: 'Unknown property' }; }
      }));
      setApplications(enriched);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="applicant-dashboard">
      <div className="page-header">
        <div>
          <h1>Welcome, {userProfile?.displayName?.split(' ')[0] || 'Applicant'}!</h1>
          <p>Start your journey to finding your next home</p>
        </div>
      </div>

      {/* Getting Started */}
      <section className="getting-started">
        <div className="getting-started-content">
          <Sparkles size={32} />
          <div>
            <h2>Find Your Perfect Home</h2>
            <p>Browse our available properties and start your application today.</p>
          </div>
          <Link to="/applicant/listings" className="btn btn-primary">
            <Search size={18} />
            Browse Properties
          </Link>
        </div>
      </section>

      {/* Application Status */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2>My Applications</h2>
          {applications.length > 0 && (
            <Link to="/applicant/applications" className="card-link">
              View All <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading applications...</div>
        ) : applications.length > 0 ? (
          <div className="applications-list">
            {applications.map(app => (
              <div key={app.id} className="application-card">
                <div className="application-icon">
                  <Home size={24} />
                </div>
                <div className="application-info">
                  <h3>{app.propertyAddress || 'Unknown property'}</h3>
                  <p>Submitted {new Date(app.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="application-status">
                  {getStatusBadge(app.status)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-applications">
            <div className="empty-icon">
              <FileText size={32} />
            </div>
            <h3>No applications yet</h3>
            <p>Browse available properties and submit your first application.</p>
            <Link to="/applicant/listings" className="btn btn-secondary">
              Browse Properties
            </Link>
          </div>
        )}
      </section>

      {/* Application Steps */}
      <section className="dashboard-section">
        <h2>How It Works</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Browse Properties</h3>
            <p>Find a property that fits your needs and budget.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Submit Application</h3>
            <p>Complete the application form and upload required documents.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Review & Approval</h3>
            <p>We'll review your application and contact you with next steps.</p>
          </div>
          <div className="step-card">
            <div className="step-number">4</div>
            <h3>Move In!</h3>
            <p>Sign your lease and get the keys to your new home.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'new':
    case 'submitted':
      return <span className="badge badge-info"><Clock size={12} /> Submitted</span>;
    case 'in_review':
      return <span className="badge badge-warning"><Clock size={12} /> In Review</span>;
    case 'approved':
      return <span className="badge badge-success"><CheckCircle size={12} /> Approved</span>;
    case 'declined':
      return <span className="badge badge-danger"><XCircle size={12} /> Declined</span>;
    case 'withdrawn':
      return <span className="badge badge-gray"><XCircle size={12} /> Withdrawn</span>;
    default:
      return <span className="badge badge-gray">{status}</span>;
  }
}
