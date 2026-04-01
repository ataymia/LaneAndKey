import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts';
import {
  User,
  Building,
  CreditCard,
  Bell,
  Palette,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { adminSettingsService } from '../../lib/firebase';
import { getStripeConfig } from '../../lib/stripe';
import type { AdminSettings } from '../../types';
import './Settings.css';

export function SettingsPage() {
  const { userProfile, updateProfile, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [, setSettings] = useState<AdminSettings | null>(null);
  const [, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('Lane & Key Properties');
  const [primaryColor, setPrimaryColor] = useState('#9BAAFF');
  const [defaultRentDueDay, setDefaultRentDueDay] = useState(1);
  const [defaultGracePeriod, setDefaultGracePeriod] = useState(5);
  const [lateFeeAmount, setLateFeeAmount] = useState(25);
  const [dailyLateFee, setDailyLateFee] = useState(10);
  const [defaultLeaseLength, setDefaultLeaseLength] = useState(12);

  // Security question
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securityMessage, setSecurityMessage] = useState('');

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  const SECURITY_QUESTIONS = [
    'What was the name of your first pet?',
    'What city were you born in?',
    'What is your mother\'s maiden name?',
    'What was the name of your first school?',
    'What is your favorite movie?',
    'What street did you grow up on?',
  ];

  const stripeConfig = getStripeConfig();

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setPhone(userProfile.phone || '');
      setSecurityQuestion(userProfile.securityQuestion || '');
    }
  }, [userProfile]);

  const loadSettings = async () => {
    try {
      const data = await adminSettingsService.get();
      if (data) {
        setSettings(data);
        setCompanyName(data.companyName || 'Lane & Key Properties');
        setPrimaryColor(data.primaryColor || '#9BAAFF');
        setDefaultRentDueDay(data.defaultRentDueDay || 1);
        setDefaultGracePeriod(data.defaultGracePeriod || 5);
        setLateFeeAmount(data.lateFeeAmount || 25);
        setDailyLateFee((data as unknown as Record<string, unknown>).dailyLateFee as number || 10);
        setDefaultLeaseLength(data.defaultLeaseLength || 12);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({
        displayName,
        phone,
      });
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const saveCompanySettings = async () => {
    setSaving(true);
    try {
      await adminSettingsService.update({
        companyName,
        primaryColor,
        defaultRentDueDay,
        defaultGracePeriod,
        lateFeeAmount,
        lateFeeType: 'fixed',
        dailyLateFee,
        defaultLeaseLength,
      } as Record<string, unknown>);
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    if (!securityQuestion || !securityAnswer.trim()) {
      setSecurityMessage('Please select a question and provide an answer.');
      return;
    }
    try {
      setSavingSecurity(true);
      setSecurityMessage('');
      await updateProfile({ securityQuestion, securityAnswer: securityAnswer.toLowerCase().trim() });
      setSecurityAnswer('');
      setSecurityMessage('Security question saved.');
      setTimeout(() => setSecurityMessage(''), 3000);
    } catch (error) {
      console.error('Error saving security question:', error);
      setSecurityMessage('Failed to save. Please try again.');
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage('');
    if (newPassword.length < 8) { setPasswordMessage('New password must be at least 8 characters.'); return; }
    if (newPassword !== confirmNewPassword) { setPasswordMessage('Passwords do not match.'); return; }
    try {
      setChangingPassword(true);
      await changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
      setPasswordMessage('Password changed successfully.');
      setTimeout(() => setPasswordMessage(''), 3000);
    } catch (error: any) {
      if (error?.code === 'auth/wrong-password' || error?.message?.includes('invalid-credential')) {
        setPasswordMessage('Current password is incorrect.');
      } else { setPasswordMessage('Failed to change password. Please try again.'); }
    } finally { setChangingPassword(false); }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User size={18} /> },
    { id: 'security', label: 'Security', icon: <ShieldCheck size={18} /> },
    { id: 'company', label: 'Company', icon: <Building size={18} /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'branding', label: 'Branding', icon: <Palette size={18} /> },
  ];

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account and preferences</p>
      </div>

      {message && (
        <div className={`settings-message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="settings-layout">
        {/* Tabs */}
        <div className="settings-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="settings-content">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="settings-section">
              <h2>Admin Profile</h2>
              <p className="section-description">Update your personal information</p>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={userProfile?.email || ''}
                  disabled
                />
                <p className="form-hint">Email cannot be changed</p>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className="form-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                />
              </div>

              <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="settings-section">
              <h2>Security Question</h2>
              <p className="section-description">
                {userProfile?.securityQuestion
                  ? 'Your security question is set. You can change it below.'
                  : 'Set up a security question to help recover your account if you forget your password.'}
              </p>

              <div className="form-group">
                <label className="form-label">Select a Question</label>
                <select
                  className="form-input"
                  value={securityQuestion}
                  onChange={e => setSecurityQuestion(e.target.value)}
                >
                  <option value="">Choose a security question...</option>
                  {SECURITY_QUESTIONS.map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Your Answer</label>
                <input
                  type="text"
                  className="form-input"
                  value={securityAnswer}
                  onChange={e => setSecurityAnswer(e.target.value)}
                  placeholder="Type your answer"
                />
              </div>

              {securityMessage && (
                <div className={`settings-message ${securityMessage.includes('Failed') ? 'error' : 'success'}`}>
                  {securityMessage}
                </div>
              )}

              <button className="btn btn-primary" onClick={handleSaveSecurity} disabled={savingSecurity} style={{ marginBottom: '2.5rem' }}>
                <Save size={18} />
                {savingSecurity ? 'Saving...' : 'Save Security Question'}
              </button>

              <h2>Change Password</h2>
              <p className="section-description">Update your account password</p>

              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-input" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} />
              </div>

              {passwordMessage && (
                <div className={`settings-message ${passwordMessage.includes('success') ? 'success' : 'error'}`}>
                  {passwordMessage}
                </div>
              )}

              <button className="btn btn-primary" onClick={handleChangePassword} disabled={changingPassword}>
                <Save size={18} />
                {changingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          )}

          {/* Company Tab */}
          {activeTab === 'company' && (
            <div className="settings-section">
              <h2>Company Information</h2>
              <p className="section-description">Configure your company details</p>

              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <h3 className="subsection-title">Property Defaults</h3>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Default Lease Length (months)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={defaultLeaseLength}
                    onChange={(e) => setDefaultLeaseLength(parseInt(e.target.value))}
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Rent Due Day</label>
                  <input
                    type="number"
                    className="form-input"
                    value={defaultRentDueDay}
                    onChange={(e) => setDefaultRentDueDay(parseInt(e.target.value))}
                    min="1"
                    max="28"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Grace Period (days)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={defaultGracePeriod}
                    onChange={(e) => setDefaultGracePeriod(parseInt(e.target.value))}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Late Fee ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={lateFeeAmount}
                    onChange={(e) => setLateFeeAmount(parseInt(e.target.value))}
                    min="0"
                  />
                  <p className="form-hint">Charged on day {defaultGracePeriod + 1} after rent due date</p>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Daily Late Fee ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={dailyLateFee}
                    onChange={(e) => setDailyLateFee(parseInt(e.target.value))}
                    min="0"
                  />
                  <p className="form-hint">Charged per day starting day {defaultGracePeriod + 2}</p>
                </div>
              </div>

              <button className="btn btn-primary" onClick={saveCompanySettings} disabled={saving}>
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="settings-section">
              <h2>Payment Settings</h2>
              <p className="section-description">Configure Stripe integration for online payments</p>

              <div className="stripe-status">
                <div className={`status-indicator ${stripeConfig.isConfigured ? 'connected' : 'disconnected'}`}>
                  <CreditCard size={24} />
                  <div>
                    <h3>{stripeConfig.isConfigured ? 'Stripe Connected' : 'Stripe Not Configured'}</h3>
                    <p>
                      {stripeConfig.isConfigured 
                        ? 'Your Stripe account is connected and ready to accept payments.'
                        : 'Connect your Stripe account to accept online rent payments.'}
                    </p>
                  </div>
                </div>
              </div>


            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h2>Notification Preferences</h2>
              <p className="section-description">Choose which notifications you want to receive</p>

              <div className="notification-options">
                <label className="form-checkbox">
                  <input type="checkbox" defaultChecked />
                  <span>New applications</span>
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" defaultChecked />
                  <span>New maintenance requests</span>
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" defaultChecked />
                  <span>Payment received</span>
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" defaultChecked />
                  <span>Payment failed</span>
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" defaultChecked />
                  <span>Lease expiring soon</span>
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" />
                  <span>Daily summary email</span>
                </label>
              </div>

              <button className="btn btn-primary" disabled={saving}>
                <Save size={18} />
                Save Preferences
              </button>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="settings-section">
              <h2>Branding</h2>
              <p className="section-description">Customize the look and feel of your portal</p>

              <div className="form-group">
                <label className="form-label">Primary Color</label>
                <div className="color-picker">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                </div>
                <p className="form-hint">This color is used for buttons, links, and accents</p>
              </div>

              <div className="form-group">
                <label className="form-label">Company Logo</label>
                <div className="logo-upload">
                  <div className="logo-preview">
                    <div className="logo-placeholder">L&K</div>
                  </div>
                  <button className="btn btn-secondary">Upload Logo</button>
                </div>
              </div>

              <button className="btn btn-primary" onClick={saveCompanySettings} disabled={saving}>
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
