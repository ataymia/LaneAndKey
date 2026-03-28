import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowLeft, Home } from 'lucide-react';
import './TenantPaymentsPage.css';

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  
  useEffect(() => {
    if (sessionId) {
      setStatus('success');
    } else {
      setStatus('error');
    }
  }, [sessionId]);
  
  if (status === 'loading') {
    return (
      <div className="page payment-result-page">
        <div className="result-container loading">
          <Loader2 className="loading-spinner" size={64} />
          <h1>Processing Payment...</h1>
          <p>Please wait while we confirm your payment.</p>
        </div>
      </div>
    );
  }
  
  if (status === 'error') {
    return (
      <div className="page payment-result-page">
        <div className="result-container error">
          <div className="result-icon error">
            <XCircle size={64} />
          </div>
          <h1>Payment Not Found</h1>
          <p>We couldn't find a payment session. Please try again or contact support.</p>
          <div className="result-actions">
            <Link to="/tenant/payments" className="btn btn-primary">
              <ArrowLeft size={18} />
              Back to Payments
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="page payment-result-page">
      <div className="result-container success">
        <div className="result-icon success">
          <CheckCircle size={64} />
        </div>
        <h1>Payment Submitted</h1>
        <p>Your payment is being processed. Your statement will update once Stripe confirms the charge.</p>
        
        {sessionId && (
          <div className="session-info">
            <span>Reference: {sessionId.slice(0, 20)}...</span>
          </div>
        )}
        
        <div className="result-actions">
          <Link to="/tenant/payments" className="btn btn-secondary">
            <ArrowLeft size={18} />
            View Payments
          </Link>
          <Link to="/tenant" className="btn btn-primary">
            <Home size={18} />
            Go to Dashboard
          </Link>
        </div>
      </div>
      
      <style>{`
        .payment-result-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
        }
        
        .result-container {
          text-align: center;
          padding: 3rem;
          max-width: 500px;
          background: white;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
        }
        
        .result-container.loading {
          background: transparent;
          box-shadow: none;
        }
        
        .result-icon {
          margin-bottom: 1.5rem;
        }
        
        .result-icon.success {
          color: var(--success, #22c55e);
        }
        
        .result-icon.error {
          color: var(--error, #ef4444);
        }
        
        .result-container h1 {
          font-size: 1.75rem;
          margin-bottom: 0.75rem;
          color: var(--gray-900);
        }
        
        .result-container p {
          color: var(--gray-600);
          margin-bottom: 1.5rem;
        }
        
        .session-info {
          background: var(--gray-100);
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          font-family: var(--font-mono, monospace);
          font-size: 0.85rem;
          color: var(--gray-600);
          margin-bottom: 1.5rem;
        }
        
        .result-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }
        
        .result-actions .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
}
