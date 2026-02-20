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
} from 'lucide-react';
import { documentService, userService, portalDocumentService } from '../../lib/firebase';
import { uploadTemplateDocument } from '../../lib/firebase/storage';
import { alertService } from '../../lib/firebase';
import type { DocumentTemplate, UserProfile } from '../../types';
import './Documents.css';

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'templates'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // User uploads tab
  const [activeTab, setActiveTab] = useState<'templates' | 'user-uploads'>('templates');
  const [userUploads, setUserUploads] = useState<any[]>([]);
  const [userUploadsLoading, setUserUploadsLoading] = useState(false);
  const [uploadUserMap, setUploadUserMap] = useState<Record<string, string>>({});

  // Send document modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendDoc, setSendDoc] = useState<DocumentTemplate | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
    loadUserUploads();
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
      setUserUploads(data);
      // Load user names
      const uids = [...new Set(data.map((d: any) => d.ownerUid || d.uploadedByUid).filter(Boolean))];
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
    try {
      const users = await userService.getAll();
      setAllUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const sendDocumentToUser = async (targetUser: UserProfile) => {
    if (!sendDoc) return;
    try {
      setSendingTo(targetUser.uid);
      // Create a document record for the user
      await documentService.create({
        name: sendDoc.name,
        type: sendDoc.type,
        url: sendDoc.url,
        isTemplate: false,
        tenantId: targetUser.uid,
      });
      // Send an alert/notification
      await alertService.create({
        userId: targetUser.uid,
        type: 'general',
        title: 'New Document Shared',
        message: `A document "${sendDoc.name}" has been shared with you. Check your Documents page.`,
        read: false,
        archived: false,
      });
      alert(`Document sent to ${targetUser.displayName || targetUser.email}`);
      setSendingTo(null);
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
      ) : (
        /* User Uploads Tab */
        <div>
          {userUploadsLoading ? (
            <div className="documents-loading">
              {[1, 2, 3].map(i => <div key={i} className="skeleton document-skeleton" />)}
            </div>
          ) : userUploads.length > 0 ? (
            <div className="documents-list">
              {userUploads.map((doc: any) => (
                <div key={doc.id} className="document-item">
                  <div className="document-icon"><FileText size={24} /></div>
                  <div className="document-info">
                    <h4>{doc.title || doc.fileName || 'Untitled'}</h4>
                    <div className="document-meta">
                      <span className="badge badge-gray">{doc.category || 'other'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} /> {uploadUserMap[doc.ownerUid || doc.uploadedByUid] || 'Unknown user'}
                      </span>
                      <span>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                  <div className="document-actions">
                    {doc.downloadUrl && (
                      <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-icon btn-ghost" title="Download">
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
