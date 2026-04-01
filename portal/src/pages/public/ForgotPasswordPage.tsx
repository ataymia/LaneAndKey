import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getUserProfileByEmail, resetPassword } from '../../lib/firebase/auth';
import { ArrowLeft, Loader2, Mail, Phone, ShieldCheck, CheckCircle } from 'lucide-react';
import './Auth.css';

type Step = 'email' | 'verify' | 'security' | 'sent';

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [securityAnswerInput, setSecurityAnswerInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Profile data fetched after email step
  const [profilePhone, setProfilePhone] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswerStored, setSecurityAnswerStored] = useState('');
  const [hasSecurityQuestion, setHasSecurityQuestion] = useState(false);

  const normalizePhone = (raw: string) => raw.replace(/\D/g, '');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Try to look up the profile for phone/security question verification.
      // This may fail if Firestore rules block unauthenticated reads — that's OK,
      // we fall through to sending the reset email directly.
      let profile: Awaited<ReturnType<typeof getUserProfileByEmail>> | null = null;
      try {
        profile = await getUserProfileByEmail(email.trim());
      } catch {
        // Firestore permission denied for unauthenticated users — skip verification steps
      }

      if (profile) {
        setProfilePhone(profile.phone || '');
        setSecurityQuestion(profile.securityQuestion || '');
        setSecurityAnswerStored((profile.securityAnswer || '').toLowerCase().trim());
        setHasSecurityQuestion(!!profile.securityQuestion && !!profile.securityAnswer);

        if (profile.phone) {
          setStep('verify');
          return;
        } else if (profile.securityQuestion && profile.securityAnswer) {
          setStep('security');
          return;
        }
      }

      // No profile found, no phone, no security question, or Firestore blocked —
      // send the reset email directly. Firebase won't reveal if the email exists.
      await resetPassword(email.trim());
      setStep('sent');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const inputDigits = normalizePhone(phoneInput);
    const profileDigits = normalizePhone(profilePhone);

    if (!profileDigits) {
      setError('No phone number on file. Contact your property manager.');
      return;
    }

    // Match last 4 digits to be user-friendly
    if (inputDigits.length < 4) {
      setError('Please enter at least the last 4 digits of your phone number.');
      return;
    }
    if (!profileDigits.endsWith(inputDigits.slice(-4)) && inputDigits !== profileDigits) {
      setError('Phone number does not match our records.');
      return;
    }

    if (hasSecurityQuestion) {
      setStep('security');
    } else {
      setLoading(true);
      try {
        await resetPassword(email.trim());
        setStep('sent');
      } catch {
        setError('Failed to send reset email. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSecurityAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!securityAnswerStored) {
        setError('Security question not configured properly. Contact your property manager.');
        return;
      }
      const userAnswer = securityAnswerInput.toLowerCase().trim();
      if (securityAnswerStored !== userAnswer) {
        setError('Incorrect answer. Please try again.');
        return;
      }
      await resetPassword(email.trim());
      setStep('sent');
    } catch {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Mask phone for display: (***) ***-1234
  const maskedPhone = profilePhone
    ? `(***) ***-${normalizePhone(profilePhone).slice(-4)}`
    : '';

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="logo-icon">L&K</div>
          </div>
          <h1>{step === 'sent' ? 'Check Your Email' : 'Reset Password'}</h1>
          <p>
            {step === 'email' && 'Enter your email to get started'}
            {step === 'verify' && 'Verify your identity'}
            {step === 'security' && 'Answer your security question'}
            {step === 'sent' && 'A reset link has been sent'}
          </p>
        </div>

        {/* Step indicator */}
        {step !== 'sent' && (
          <div className="forgot-steps">
            <div className={`forgot-step ${step === 'email' ? 'active' : 'done'}`}>
              <Mail size={14} />
              <span>Email</span>
            </div>
            {profilePhone && (
              <div className={`forgot-step ${step === 'verify' ? 'active' : step === 'security' ? 'done' : ''}`}>
                <Phone size={14} />
                <span>Phone</span>
              </div>
            )}
            {hasSecurityQuestion && (
              <div className={`forgot-step ${step === 'security' ? 'active' : ''}`}>
                <ShieldCheck size={14} />
                <span>Security</span>
              </div>
            )}
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? <><Loader2 size={18} className="spin" /> Checking...</> : 'Continue'}
            </button>
          </form>
        )}

        {/* Step 2: Verify phone */}
        {step === 'verify' && (
          <form onSubmit={handleVerifyPhone} className="auth-form">
            <p className="forgot-hint">
              Enter the phone number associated with your account ending in <strong>{maskedPhone}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-input"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                placeholder="(555) 123-4567 or last 4 digits"
                required
                disabled={loading}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? <><Loader2 size={18} className="spin" /> Verifying...</> : 'Verify'}
            </button>
          </form>
        )}

        {/* Step 3: Security question */}
        {step === 'security' && (
          <form onSubmit={handleSecurityAnswer} className="auth-form">
            <div className="form-group">
              <label className="form-label">{securityQuestion}</label>
              <input
                type="text"
                className="form-input"
                value={securityAnswerInput}
                onChange={e => setSecurityAnswerInput(e.target.value)}
                placeholder="Your answer"
                required
                disabled={loading}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? <><Loader2 size={18} className="spin" /> Verifying...</> : 'Submit Answer'}
            </button>
          </form>
        )}

        {/* Step 4: Success */}
        {step === 'sent' && (
          <div className="forgot-success">
            <CheckCircle size={48} className="forgot-success-icon" />
            <p>We've sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link to set a new password.</p>
            <p className="forgot-hint">Didn't get the email? Check your spam folder or try again.</p>
          </div>
        )}

        <div className="auth-footer">
          <p>
            <Link to="/login" className="forgot-back-link">
              <ArrowLeft size={16} /> Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
