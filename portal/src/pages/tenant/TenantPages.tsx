// Placeholder pages for Tenant portal
export function TenantLeasePage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>My Lease</h1>
        <p>View your lease details and documents</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">📄</div>
        <h3 className="empty-state-title">No active lease</h3>
        <p className="empty-state-description">
          Your lease details will appear here once you have an active lease.
        </p>
      </div>
    </div>
  );
}

export function TenantPaymentsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Payments</h1>
        <p>View payment history and make payments</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">💳</div>
        <h3 className="empty-state-title">No payment history</h3>
        <p className="empty-state-description">
          Your payment history will appear here.
        </p>
      </div>
    </div>
  );
}

export function TenantMaintenancePage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Maintenance</h1>
        <p>Submit and track maintenance requests</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">🔧</div>
        <h3 className="empty-state-title">No maintenance requests</h3>
        <p className="empty-state-description">
          Submit a request if you need something fixed.
        </p>
        <button className="btn btn-primary">Submit Request</button>
      </div>
    </div>
  );
}

export function TenantDocumentsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Documents</h1>
        <p>Upload and view your documents</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">📁</div>
        <h3 className="empty-state-title">No documents</h3>
        <p className="empty-state-description">
          Your documents will appear here.
        </p>
        <button className="btn btn-primary">Upload Document</button>
      </div>
    </div>
  );
}

export function TenantMessagesPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Messages</h1>
        <p>Communicate with your property manager</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">💬</div>
        <h3 className="empty-state-title">No messages</h3>
        <p className="empty-state-description">
          Start a conversation with your property manager.
        </p>
        <button className="btn btn-primary">New Message</button>
      </div>
    </div>
  );
}

export function TenantAlertsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Alerts</h1>
        <p>View your notifications</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">🔔</div>
        <h3 className="empty-state-title">No alerts</h3>
        <p className="empty-state-description">
          You're all caught up! No new notifications.
        </p>
      </div>
    </div>
  );
}

export function TenantSettingsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account settings</p>
      </div>
      <div className="card" style={{ maxWidth: 600, padding: '2rem' }}>
        <h3>Coming Soon</h3>
        <p>Account settings will be available here.</p>
      </div>
    </div>
  );
}
