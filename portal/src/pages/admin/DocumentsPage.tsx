import { useState, useEffect } from 'react';
import {
  FolderOpen,
  Upload,
  Trash2,
  Download,
  FileText,
  FilePlus,
  Search,
} from 'lucide-react';
import { documentService } from '../../lib/firebase';
import type { DocumentTemplate } from '../../types';
import './Documents.css';

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'templates'>('all');

  useEffect(() => {
    loadDocuments();
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

  return (
    <div className="documents-page">
      <div className="page-header">
        <div>
          <h1>Documents & Templates</h1>
          <p>Manage lease templates and documents</p>
        </div>
        <button className="btn btn-primary">
          <Upload size={18} />
          Upload Document
        </button>
      </div>

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
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-icon btn-ghost">
                  <Download size={16} />
                </a>
                <button className="btn btn-icon btn-ghost">
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
          <button className="btn btn-primary">
            <FilePlus size={18} />
            Upload Document
          </button>
        </div>
      )}
    </div>
  );
}
