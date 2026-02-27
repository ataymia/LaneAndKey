import { useEffect, useState } from 'react';
import { CheckCircle, Circle, FileText, Phone, CreditCard } from 'lucide-react';
import { completeOnboardingStep, getOnboardingStatus } from '../../lib/api/portalApi';
import { useAuth } from '../../contexts';

export function TenantOnboardingPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lease, setLease] = useState<any>(null);
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [preferredContactMethod, setPreferredContactMethod] = useState<'email' | 'phone' | 'sms'>('email');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await getOnboardingStatus();
      setLease(data.lease);
      if (userProfile?.preferredContactMethod) {
        setPreferredContactMethod(userProfile.preferredContactMethod);
      }
      if (userProfile?.emergencyContact) {
        setEmergencyName(userProfile.emergencyContact.name || '');
        setEmergencyPhone(userProfile.emergencyContact.phone || '');
        setEmergencyRelationship(userProfile.emergencyContact.relationship || '');
      }
    } catch (loadError) {
      console.error('Failed to load onboarding:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load onboarding');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const checklist = lease?.onboardingChecklist || {
    leaseSigned: false,
    contactConfirmed: false,
    paymentReady: false,
  };

  const markLeaseSigned = async () => {
    await completeOnboardingStep({ step: 'leaseSigned' });
    await load();
  };

  const markContactConfirmed = async () => {
    await completeOnboardingStep({
      step: 'contactConfirmed',
      phone,
      preferredContactMethod,
      emergencyContact: {
        name: emergencyName,
        phone: emergencyPhone,
        relationship: emergencyRelationship,
      },
    });
    await load();
  };

  const markPaymentReady = async () => {
    await completeOnboardingStep({ step: 'paymentReady' });
    await load();
  };

  const ItemIcon = ({ done }: { done: boolean }) => (done ? <CheckCircle size={18} /> : <Circle size={18} />);

  if (loading) {
    return <div className="page"><p>Loading onboarding...</p></div>;
  }

  if (error) {
    return <div className="page"><p>{error}</p></div>;
  }

  if (!lease) {
    return <div className="page"><p>No pending lease onboarding found.</p></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tenant Onboarding</h1>
        <p>Complete all steps to activate your lease</p>
      </div>

      <div className="card" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ItemIcon done={checklist.leaseSigned} />
          <FileText size={16} />
          <strong>Review & Sign Lease</strong>
          {!checklist.leaseSigned && <button className="btn btn-sm btn-primary" onClick={markLeaseSigned}>Mark Complete</button>}
        </div>

        <div style={{ display: 'grid', gap: '0.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ItemIcon done={checklist.contactConfirmed} />
            <Phone size={16} />
            <strong>Confirm Contact Info</strong>
          </div>
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <select value={preferredContactMethod} onChange={(e) => setPreferredContactMethod(e.target.value as 'email' | 'phone' | 'sms')}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="sms">SMS</option>
          </select>
          <input placeholder="Emergency contact name" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
          <input placeholder="Emergency contact phone" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
          <input placeholder="Relationship" value={emergencyRelationship} onChange={(e) => setEmergencyRelationship(e.target.value)} />
          {!checklist.contactConfirmed && (
            <button className="btn btn-sm btn-primary" onClick={markContactConfirmed}>Save Contact Step</button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
          <ItemIcon done={checklist.paymentReady} />
          <CreditCard size={16} />
          <strong>Payment Setup Ready</strong>
          {!checklist.paymentReady && <button className="btn btn-sm btn-primary" onClick={markPaymentReady}>Mark Complete</button>}
        </div>
      </div>
    </div>
  );
}
