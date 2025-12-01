// Placeholder pages for Applicant portal
export function ApplicantApplicationsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>My Applications</h1>
        <p>Track your submitted applications</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">📄</div>
        <h3 className="empty-state-title">No applications</h3>
        <p className="empty-state-description">
          Your submitted applications will appear here.
        </p>
      </div>
    </div>
  );
}

export function ApplicantDocumentsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Documents</h1>
        <p>Upload documents for your application</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">📁</div>
        <h3 className="empty-state-title">No documents</h3>
        <p className="empty-state-description">
          Upload required documents for your application.
        </p>
        <button className="btn btn-primary">Upload Document</button>
      </div>
    </div>
  );
}

export function ApplicantMessagesPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Messages</h1>
        <p>Communicate with the property manager</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">💬</div>
        <h3 className="empty-state-title">No messages</h3>
        <p className="empty-state-description">
          Messages will appear here once you start an application.
        </p>
      </div>
    </div>
  );
}

export function ApplicantSettingsPage() {
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
