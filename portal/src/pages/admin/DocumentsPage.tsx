import { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  Upload,
  Trash2,
  Download,
  FileText,
  FilePlus,
  Search,
  Send,
  X,
  User,
  Users,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { documentService, userService, alertService, activityLogService } from '../../lib/firebase/firestore';
import { portalDocumentService } from '../../lib/firebase/rentStatements';
import { uploadTemplateDocument } from '../../lib/firebase/storage';
import { useAuth } from '../../contexts';
import type { DocumentTemplate, UserProfile, PortalDocument } from '../../types';
import './Documents.css';

export function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'templates'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);

  // User uploads tab
  const [activeTab, setActiveTab] = useState<'templates' | 'user-uploads' | 'lease-docs'>('templates');
  const [userUploads, setUserUploads] = useState<PortalDocument[]>([]);
  const [userUploadsLoading, setUserUploadsLoading] = useState(false);
  const [uploadUserMap, setUploadUserMap] = useState<Record<string, string>>({});

  // Lease documents tab
  const [leaseDocs, setLeaseDocs] = useState<PortalDocument[]>([]);
  const [leaseDocsLoading, setLeaseDocsLoading] = useState(false);

  // Send document modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendDoc, setSendDoc] = useState<DocumentTemplate | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [requireSignature, setRequireSignature] = useState(false);

  useEffect(() => {
    loadDocuments();
    loadUserUploads();
    loadLeaseDocs();
  }, []);

  const loadDocuments = async () => {
    try {
      const data = await documentService.getTemplates();
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = filter === 'templates'
    ? documents.filter(d => d.isTemplate)
    : documents;

  const loadUserUploads = async () => {
    try {
      setUserUploadsLoading(true);
      const data = await portalDocumentService.getAll();
      // Split: lease docs vs general uploads
      const general = data.filter((d: PortalDocument) => d.category !== 'lease');
      setUserUploads(general);
      // Load user names
      const uids = [...new Set(data.map((d: PortalDocument) => d.ownerUid || d.uploadedByUid).filter(Boolean))];
      const names: Record<string, string> = {};
      for (const uid of uids) {
        if (!names[uid]) {
          try {
            const u = await userService.get(uid);
            if (u) names[uid] = u.displayName || u.email;
          } catch { /* skip */ }
        }
      }
      setUploadUserMap(names);
    } catch (error) {
      console.error('Error loading user uploads:', error);
    } finally {
      setUserUploadsLoading(false);
    }
  };

  const loadLeaseDocs = async () => {
    try {
      setLeaseDocsLoading(true);
      const data = await portalDocumentService.getAll();
      const ld = data.filter((d: PortalDocument) => d.category === 'lease');
      setLeaseDocs(ld);
      // Ensure user names are loaded
      const uids = [...new Set(ld.map((d: PortalDocument) => d.ownerUid).filter(Boolean))];
      const names: Record<string, string> = { ...uploadUserMap };
      for (const uid of uids) {
        if (!names[uid]) {
          try {
            const u = await userService.get(uid);
            if (u) names[uid] = u.displayName || u.email;
          } catch { /* skip */ }
        }
      }
      setUploadUserMap(names);
    } catch (error) {
      console.error('Error loading lease docs:', error);
    } finally {
      setLeaseDocsLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadTemplateDocument(file);
      await documentService.create({
        name: file.name,
        type: 'other',
        url,
        isTemplate: true,
      });
      await loadDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc: DocumentTemplate) => {
    if (!confirm(`Delete "${doc.name}"?`)) return;
    try {
      await documentService.delete(doc.id);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const openSendModal = async (doc: DocumentTemplate) => {
    setSendDoc(doc);
    setShowSendModal(true);
    setRequireSignature(false);
    try {
      const users = await userService.getAll();
      setAllUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const sendDocumentToUser = async (targetUser: UserProfile) => {
    if (!sendDoc || !user) return;
    try {
      setSendingTo(targetUser.uid);

      if (requireSignature) {
        // Create a PortalDocument with signature tracking
        await portalDocumentService.create({
          ownerUid: targetUser.uid,
          uploadedByUid: user.uid,
          roleScope: targetUser.role === 'tenant' ? 'tenant' : 'applicant',
          category: 'lease',
          fileName: sendDoc.name,
          originalFilePath: sendDoc.url,
          status: 'pending_signature',
          requiresSignature: true,
        });
      } else {
        // Create a simple document record
        await documentService.create({
          name: sendDoc.name,
          type: sendDoc.type,
          url: sendDoc.url,
          isTemplate: false,
          tenantId: targetUser.uid,
        });
      }

      // Send notification
      await alertService.create({
        userId: targetUser.uid,
        type: 'general',
        title: requireSignature ? 'Lease Document for Signature' : 'New Document Shared',
        message: requireSignature
          ? `A lease document "${sendDoc.name}" requires your signature. Check your Documents page.`
          : `A document "${sendDoc.name}" has been shared with you. Check your Documents page.`,
        read: false,
        archived: false,
      });

      // Log activity
      try {
        await activityLogService.create({
          actorUid: user.uid,
          targetUid: targetUser.uid,
          action: 'document_sent',
          targetType: 'document',
          targetId: sendDoc.id,
          metadata: { fileName: sendDoc.name, requiresSignature: requireSignature },
        });
      } catch { /* non-blocking */ }

      alert(`Document sent to ${targetUser.displayName || targetUser.email}`);
      setSendingTo(null);
      if (requireSignature) loadLeaseDocs();
    } catch (error) {
      console.error('Error sending document:', error);
      alert('Failed to send document');
      setSendingTo(null);
    }
  };

  const filteredUsers = userSearch
    ? allUsers.filter(u => {
        const q = userSearch.toLowerCase();
        return u.displayName?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      })
    : allUsers;

  return (
    <div className="documents-page">
      <div className="page-header">
        <div>
          <h1>Documents</h1>
          <p>Manage templates and view user uploads</p>
        </div>
        {activeTab === 'templates' && (
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload size={18} />
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleUpload}
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.txt,.jpg,.png"
        />
      </div>

      {/* Tab Switcher */}
      <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
        <button className={`filter-tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
          <FileText size={14} /> Templates & Documents
        </button>
        <button className={`filter-tab ${activeTab === 'lease-docs' ? 'active' : ''}`} onClick={() => setActiveTab('lease-docs')}>
          <CheckCircle size={14} /> Lease Documents ({leaseDocs.length})
        </button>
        <button className={`filter-tab ${activeTab === 'user-uploads' ? 'active' : ''}`} onClick={() => setActiveTab('user-uploads')}>
          <Users size={14} /> User Uploads ({userUploads.length})
        </button>
      </div>

      {activeTab === 'templates' ? (
      <>
      {/* Folder Categories */}
      <div className="folder-grid">
        <div className="folder-card">
          <div className="folder-icon">📄</div>
          <div className="folder-info">
            <h3>Lease Templates</h3>
            <p>{documents.filter(d => d.type === 'lease').length} files</p>
          </div>
        </div>
        <div className="folder-card">
          <div className="folder-icon">📎</div>
          <div className="folder-info">
            <h3>Addenda</h3>
            <p>{documents.filter(d => d.type === 'addendum').length} files</p>
          </div>
        </div>
        <div className="folder-card">
          <div className="folder-icon">📢</div>
          <div className="folder-info">
            <h3>Notices</h3>
            <p>{documents.filter(d => d.type === 'notice').length} files</p>
          </div>
        </div>
        <div className="folder-card">
          <div className="folder-icon">✅</div>
          <div className="folder-info">
            <h3>Checklists</h3>
            <p>{documents.filter(d => d.type === 'checklist').length} files</p>
          </div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search documents..." />
        </div>
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-tab ${filter === 'templates' ? 'active' : ''}`}
            onClick={() => setFilter('templates')}
          >
            Templates Only
          </button>
        </div>
      </div>

      {loading ? (
        <div className="documents-loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton document-skeleton" />
          ))}
        </div>
      ) : filteredDocuments.length > 0 ? (
        <div className="documents-list">
          {filteredDocuments.map(doc => (
            <div key={doc.id} className="document-item">
              <div className="document-icon">
                <FileText size={24} />
              </div>
              <div className="document-info">
                <h4>{doc.name}</h4>
                <div className="document-meta">
                  <span className="badge badge-gray">{doc.type}</span>
                  {doc.isTemplate && <span className="badge badge-primary">Template</span>}
                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="document-actions">
                <button className="btn btn-icon btn-ghost" onClick={() => openSendModal(doc)} title="Send to User">
                  <Send size={16} />
                </button>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-icon btn-ghost" title="Download">
                  <Download size={16} />
                </a>
                <button className="btn btn-icon btn-ghost" onClick={() => handleDelete(doc)} title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FolderOpen size={32} />
          </div>
          <h3 className="empty-state-title">No documents yet</h3>
          <p className="empty-state-description">
            Upload lease templates and other documents to get started.
          </p>
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <FilePlus size={18} />
            Upload Document
          </button>
        </div>
      )}
      </>
      ) : activeTab === 'lease-docs' ? (
        /* Lease Documents Tab */
        <div>
          {leaseDocsLoading ? (
            <div className="documents-loading">
              {[1, 2, 3].map(i => <div key={i} className="skeleton document-skeleton" />)}
            </div>
          ) : leaseDocs.length > 0 ? (
            <div className="documents-list">
              {leaseDocs.map((doc: PortalDocument) => (
                <div key={doc.id} className="document-item">
                  <div className="document-icon"><FileText size={24} /></div>
                  <div className="document-info">
                    <h4>{doc.fileName}</h4>
                    <div className="document-meta">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} /> {uploadUserMap[doc.ownerUid] || 'Unknown'}
                      </span>
                      {doc.requiresSignature && (
                        doc.status === 'signed' ? (
                          <span className="badge badge-success"><CheckCircle size={12} /> Signed</span>
                        ) : (
                          <span className="badge badge-warning"><Clock size={12} /> Pending Signature</span>
                        )
                      )}
                      {!doc.requiresSignature && (
                        <span className="badge badge-info">Sent</span>
                      )}
                      <span>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                  <div className="document-actions">
                    {doc.originalFilePath && (
                      <a href={doc.originalFilePath} target="_blank" rel="noopener noreferrer" className="btn btn-icon btn-ghost" title="View">
                        <Download size={16} />
                      </a>
                    )}
                    {doc.signedFilePath && (
                      <a href={doc.signedFilePath} target="_blank" rel="noopener noreferrer" className="btn btn-icon btn-ghost" title="Signed Copy">
                        <CheckCircle size={16} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><FolderOpen size={32} /></div>
              <h3 className="empty-state-title">No lease documents</h3>
              <p className="empty-state-description">
                Send a template to a tenant with "Require Signature" to track lease documents here.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* User Uploads Tab */
        <div>
          {userUploadsLoading ? (
            <div className="documents-loading">
              {[1, 2, 3].map(i => <div key={i} className="skeleton document-skeleton" />)}
            </div>
          ) : userUploads.length > 0 ? (
            <div className="documents-list">
              {userUploads.map((doc: PortalDocument) => (
                <div key={doc.id} className="document-item">
                  <div className="document-icon"><FileText size={24} /></div>
                  <div className="document-info">
                    <h4>{doc.fileName || 'Untitled'}</h4>
                    <div className="document-meta">
                      <span className="badge badge-gray">{doc.category || 'other'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} /> {uploadUserMap[doc.ownerUid || doc.uploadedByUid] || 'Unknown user'}
                      </span>
                      <span>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                  <div className="document-actions">
                    {doc.originalFilePath && (
                      <a href={doc.originalFilePath} target="_blank" rel="noopener noreferrer" className="btn btn-icon btn-ghost" title="Download">
                        <Download size={16} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><FolderOpen size={32} /></div>
              <h3 className="empty-state-title">No user uploads yet</h3>
              <p className="empty-state-description">Documents uploaded by tenants and applicants will appear here.</p>
            </div>
          )}
        </div>
      )}

      {/* Send Document Modal */}
      {showSendModal && sendDoc && (
        <div className="modal-overlay" onClick={() => { setShowSendModal(false); setUserSearch(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Send size={20} /> Send Document</h2>
              <button className="modal-close" onClick={() => { setShowSendModal(false); setUserSearch(''); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="send-doc-info">
                <FileText size={20} />
                <span>{sendDoc.name}</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={requireSignature}
                  onChange={e => setRequireSignature(e.target.checked)}
                />
                Require signature (creates a lease document for tracking)
              </label>
              <div className="search-box" style={{ marginBottom: '1rem' }}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="user-picker-list">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(u => (
                    <div
                      key={u.uid}
                      className="user-picker-item"
                      onClick={() => sendingTo !== u.uid && sendDocumentToUser(u)}
                    >
                      <div className="user-picker-avatar">
                        <User size={18} />
                      </div>
                      <div className="user-picker-info">
                        <div className="user-picker-name">{u.displayName || 'No Name'}</div>
                        <div className="user-picker-email">{u.email}</div>
                      </div>
                      <span className={`badge badge-${u.role === 'admin' ? 'primary' : u.role === 'tenant' ? 'success' : 'info'}`}>
                        {u.role}
                      </span>
                      {sendingTo === u.uid && <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>Sending...</span>}
                    </div>
                  ))
                ) : (
                  <div className="no-users-found">
                    <p>No users found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
