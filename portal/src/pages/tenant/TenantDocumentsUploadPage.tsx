import { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  Upload,
  FileText,
  Download,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  File as FileIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts';
import { portalDocumentService, isFirebaseConfigured } from '../../lib/firebase';
import { uploadFile, getFileUrl } from '../../lib/firebase/storage';
import type { PortalDocument, PortalDocCategory, PortalDocStatus } from '../../types';
import './TenantDocuments.css';

/* ─── Category labels ─── */
const CATEGORIES: Record<string, string> = {
  pay_stub: 'Pay Stubs',
  id: 'Government ID',
  bank_statement: 'Bank Statements',
  tax_return: 'Tax Returns',
  lease: 'Lease Agreement',
  other: 'Other',
};

const UPLOAD_CATEGORIES = Object.entries(CATEGORIES).filter(([k]) => k !== 'lease');

/* ─── Demo data ─── */
const DEMO_DOCS: PortalDocument[] = [
  {
    id: 'demo-doc-1',
    ownerUid: 'demo-tenant-001',
    uploadedByUid: 'demo-tenant-001',
    roleScope: 'tenant',
    category: 'pay_stub' as PortalDocCategory,
    fileName: 'January_2026_PayStub.pdf',
    originalFilePath: '',
    status: 'approved' as PortalDocStatus,
    requiresSignature: false,
    createdAt: new Date('2026-01-05'),
    updatedAt: new Date('2026-01-06'),
  },
  {
    id: 'demo-doc-2',
    ownerUid: 'demo-tenant-001',
    uploadedByUid: 'demo-tenant-001',
    roleScope: 'tenant',
    category: 'id' as PortalDocCategory,
    fileName: 'DriversLicense_Front.jpg',
    originalFilePath: '',
    status: 'pending' as PortalDocStatus,
    requiresSignature: false,
    createdAt: new Date('2026-01-03'),
    updatedAt: new Date('2026-01-03'),
  },
  {
    id: 'demo-doc-3',
    ownerUid: 'demo-tenant-001',
    uploadedByUid: 'admin-001',
    roleScope: 'tenant',
    category: 'lease' as PortalDocCategory,
    fileName: 'Lease_Agreement_2026.pdf',
    originalFilePath: '',
    status: 'pending_signature' as PortalDocStatus,
    requiresSignature: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
];

/* ─── Helpers ─── */
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadge(status: string) {
  switch (status) {
    case 'approved': return <span className="badge badge-success"><CheckCircle size={12} /> Approved</span>;
    case 'rejected': return <span className="badge badge-error"><X size={12} /> Rejected</span>;
    case 'pending_signature': return <span className="badge badge-warning"><AlertCircle size={12} /> Needs Signature</span>;
    default: return <span className="badge badge-info"><Clock size={12} /> Pending Review</span>;
  }
}

function fileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext || '')) return <FileText size={20} className="icon-pdf" />;
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return <FileIcon size={20} className="icon-img" />;
  return <FileIcon size={20} />;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/* ─── Component ─── */
export function TenantDocumentsUploadPage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('pay_stub');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { loadDocuments(); }, []);

  async function loadDocuments() {
    setLoading(true);
    try {
      if (!isFirebaseConfigured || !user) {
        setDocuments(DEMO_DOCS);
        return;
      }
      const docs = await portalDocumentService.getByOwner(user.uid);
      setDocuments(docs);
    } catch (err) {
      console.error('Error loading documents:', err);
      setDocuments(DEMO_DOCS);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PDF, JPEG, PNG, and WebP files are allowed.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File must be smaller than 10 MB.');
      return;
    }

    setError(null);
    setUploading(true);
    try {
      if (!user) throw new Error('Not signed in');
      const storagePath = `documents/${user.uid}/${uploadCategory}/${Date.now()}_${file.name}`;
      const downloadUrl = await uploadFile(storagePath, file, { category: uploadCategory });
      void downloadUrl; // URL not needed; storing Storage path instead

      // Create Firestore record
      await portalDocumentService.create({
        ownerUid: user.uid,
        uploadedByUid: user.uid,
        roleScope: 'tenant',
        category: uploadCategory as PortalDocCategory,
        fileName: file.name,
        originalFilePath: storagePath,
        status: 'pending' as PortalDocStatus,
        requiresSignature: false,
      });

      setSuccess(`"${file.name}" uploaded successfully.`);
      await loadDocuments();
    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDownload(doc: PortalDocument) {
    try {
      if (!doc.originalFilePath) return;
      const url = await getFileUrl(doc.originalFilePath);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Download error:', err);
      setError('Could not download file.');
    }
  }

  /* ─── Group by category ─── */
  const grouped = Object.entries(CATEGORIES).map(([key, label]) => ({
    key,
    label,
    docs: documents.filter((d) => d.category === key),
  })).filter((g) => g.docs.length > 0);

  if (loading) {
    return (
      <div className="page"><div className="loading-container"><Loader2 size={32} className="spinner" /><p>Loading documents…</p></div></div>
    );
  }

  return (
    <div className="tenant-documents-page">
      <div className="page-header">
        <div>
          <h1><FolderOpen size={24} /> My Documents</h1>
          <p>Upload documents and view your lease</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <CheckCircle size={16} /> {success}
          <button onClick={() => setSuccess(null)}>&times;</button>
        </div>
      )}

      {/* Upload card */}
      <div className="upload-card">
        <h3><Upload size={18} /> Upload a Document</h3>
        <div className="upload-form">
          <div className="upload-select">
            <label>Category</label>
            <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
              {UPLOAD_CATEGORIES.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div className="upload-file-btn">
            <label className={`btn btn-primary ${uploading ? 'disabled' : ''}`}>
              {uploading ? <><Loader2 size={16} className="spinner" /> Uploading…</> : <><Upload size={16} /> Choose File</>}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                style={{ display: 'none' }}
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
        <p className="upload-hint">PDF, JPEG, PNG, or WebP — max 10 MB</p>
      </div>

      {/* Lease needing signature */}
      {documents.filter((d) => d.requiresSignature && d.status === 'pending_signature').length > 0 && (
        <div className="signature-banner">
          <AlertCircle size={20} />
          <div>
            <strong>Lease ready for signature</strong>
            <p>You have a document that requires your electronic signature.</p>
          </div>
          <a href="/portal/tenant/lease" className="btn btn-primary btn-sm">View &amp; Sign</a>
        </div>
      )}

      {/* Document list grouped by category */}
      {grouped.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={48} />
          <h3>No documents yet</h3>
          <p>Upload your first document above</p>
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.key} className="doc-group">
            <h2>{group.label} ({group.docs.length})</h2>
            <div className="doc-list">
              {group.docs.map((doc) => (
                <div key={doc.id} className="doc-row">
                  <div className="doc-icon">{fileIcon(doc.fileName)}</div>
                  <div className="doc-info">
                    <span className="doc-name">{doc.fileName}</span>
                    <span className="doc-date">{fmtDate(doc.createdAt)}</span>
                  </div>
                  <div className="doc-status">{statusBadge(doc.status)}</div>
                  <div className="doc-actions">
                    {doc.originalFilePath && (
                      <button className="icon-btn" title="Download" onClick={() => handleDownload(doc)}>
                        <Download size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
