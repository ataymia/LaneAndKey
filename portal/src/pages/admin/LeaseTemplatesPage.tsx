import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Edit, Copy, Eye, Archive, CheckCircle,
  Search, RefreshCw, X, AlertTriangle, Trash2,
  Code, Columns, Save,
} from 'lucide-react';
import {
  leaseTemplateService,
  activityLogService,
} from '../../lib/firebase/firestore';
import { useAuth } from '../../contexts';
import {
  extractPlaceholders,
  extractAnchors,
  buildFieldSchemaFromPlaceholders,
  buildSignatureSchemaFromAnchors,
  validateAnchors,
} from '../../lib/leaseGenerator';
import type {
  LeaseTemplate,
  LeaseTemplateStatus,
  TemplateFieldDef,
  SignatureFieldDef,
} from '../../types';
import './LeaseTemplates.css';

/* ─── Helpers ─── */
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function bumpVersion(v: string, part: 'major' | 'minor' | 'patch'): string {
  const [major, minor, patch] = v.split('.').map(Number);
  if (part === 'major') return `${major + 1}.0.0`;
  if (part === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const STATUS_BADGE: Record<LeaseTemplateStatus, string> = {
  draft: 'badge-warning',
  published: 'badge-success',
  archived: 'badge-gray',
};

const DEFAULT_TEMPLATE_BODY = `<h1>RESIDENTIAL LEASE AGREEMENT</h1>

<p>This Residential Lease Agreement ("Agreement") is entered into as of {{LEASE_START_DATE}},
by and between the Landlord and the Tenant identified below.</p>

<h2>1. PARTIES</h2>
<p><strong>Landlord:</strong> Lane &amp; Key Properties LLC</p>
<p><strong>Tenant:</strong> {{TENANT_FULL_NAME}}</p>

<h2>2. PROPERTY</h2>
<p>The Landlord hereby leases to the Tenant the property located at:</p>
<p>{{PROPERTY_ADDRESS}}</p>

<h2>3. TERM</h2>
<p>The term of this lease shall begin on {{LEASE_START_DATE}} and end on {{LEASE_END_DATE}}, unless sooner terminated in accordance with this Agreement.</p>

<h2>4. RENT</h2>
<p>Tenant agrees to pay monthly rent in the amount of {{RENT_AMOUNT}}, due on the 1st day of each month. A late fee of {{LATE_FEE_POLICY}} will apply after the grace period.</p>

<h2>5. SECURITY DEPOSIT</h2>
<p>Tenant shall pay a security deposit of {{DEPOSIT_AMOUNT}} upon execution of this lease.</p>

<h2>6. OCCUPANTS</h2>
<p>The following persons are authorized to reside at the Property:</p>
<p>{{OCCUPANTS}}</p>

<h2>7. PETS</h2>
<p>{{PETS}}</p>

<h2>8. UTILITIES</h2>
<p>The following utilities are included in rent: {{INCLUDED_UTILITIES}}</p>

<h2>9. TENANT ACKNOWLEDGEMENTS</h2>
<p>Tenant acknowledges receipt and understanding of Sections 1–8 above.</p>
<p>[[INITIAL:tenant:SECTIONS_1_8]]</p>

<h2>10. ADDITIONAL TERMS</h2>
<p>{{ADDITIONAL_TERMS}}</p>
<p>[[INITIAL:tenant:SECTION_10]]</p>

<h2>11. SIGNATURES</h2>
<p>By signing below, the parties agree to the terms of this Residential Lease Agreement.</p>

<p>Tenant Signature:</p>
<p>[[SIGNATURE:tenant]]</p>
<p>Date:</p>
<p>[[DATE:tenant_signed]]</p>

<p>Landlord Signature:</p>
<p>[[SIGNATURE:landlord]]</p>
<p>Date:</p>
<p>[[DATE:landlord_signed]]</p>
`;

/* ─── Component ─── */
export function LeaseTemplatesPage() {
  const { user: adminUser } = useAuth();
  const [templates, setTemplates] = useState<LeaseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Editor state
  const [editing, setEditing] = useState<LeaseTemplate | null>(null);
  const [editorMode, setEditorMode] = useState<'source' | 'preview' | 'split'>('split');
  const [editorName, setEditorName] = useState('');
  const [editorVersion, setEditorVersion] = useState('1.0.0');
  const [editorBody, setEditorBody] = useState('');
  const [editorFields, setEditorFields] = useState<TemplateFieldDef[]>([]);
  const [editorSigFields, setEditorSigFields] = useState<SignatureFieldDef[]>([]);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  /* ─── Load ─── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await leaseTemplateService.getAll();
      setTemplates(all);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ─── Filtered list ─── */
  const filtered = templates.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.version.includes(search)
  );

  /* ─── Parse body on change ─── */
  const parseBody = useCallback((body: string) => {
    const placeholders = extractPlaceholders(body);
    const anchors = extractAnchors(body);
    setEditorFields(buildFieldSchemaFromPlaceholders(placeholders));
    setEditorSigFields(buildSignatureSchemaFromAnchors(anchors));
    setValidationErrors([]);
  }, []);

  /* ─── Open new template ─── */
  const openNew = () => {
    setEditing(null);
    setEditorName('');
    setEditorVersion('1.0.0');
    setEditorBody(DEFAULT_TEMPLATE_BODY);
    parseBody(DEFAULT_TEMPLATE_BODY);
    setEditorError(null);
    setShowEditor(true);
  };

  /* ─── Open edit ─── */
  const openEdit = (t: LeaseTemplate) => {
    if (t.status === 'published') return; // Can't edit published
    setEditing(t);
    setEditorName(t.name);
    setEditorVersion(t.version);
    setEditorBody(t.templateBody);
    setEditorFields(t.fieldSchema);
    setEditorSigFields(t.signatureSchema);
    setEditorError(null);
    setShowEditor(true);
  };

  /* ─── Clone to new draft ─── */
  const cloneToDraft = async (t: LeaseTemplate) => {
    setEditing(null);
    setEditorName(`${t.name} (copy)`);
    setEditorVersion(bumpVersion(t.version, 'minor'));
    setEditorBody(t.templateBody);
    parseBody(t.templateBody);
    setEditorError(null);
    setShowEditor(true);
  };

  /* ─── Save draft ─── */
  const saveDraft = async () => {
    if (!editorName.trim()) { setEditorError('Name is required'); return; }
    if (!editorBody.trim()) { setEditorError('Template body is required'); return; }

    // Re-parse to get latest fields
    const placeholders = extractPlaceholders(editorBody);
    const anchors = extractAnchors(editorBody);
    const fields = buildFieldSchemaFromPlaceholders(placeholders);
    const sigFields = buildSignatureSchemaFromAnchors(anchors);

    setSaving(true);
    setEditorError(null);
    try {
      if (editing) {
        await leaseTemplateService.update(editing.id, {
          name: editorName.trim(),
          version: editorVersion,
          templateBody: editorBody,
          fieldSchema: fields,
          signatureSchema: sigFields,
        });
      } else {
        await leaseTemplateService.create({
          name: editorName.trim(),
          version: editorVersion,
          status: 'draft',
          templateFormat: 'html',
          templateBody: editorBody,
          fieldSchema: fields,
          signatureSchema: sigFields,
          createdByUid: adminUser!.uid,
        });
        if (adminUser) {
          await activityLogService.create({
            actorUid: adminUser.uid,
            action: 'template_created',
            targetType: 'document',
            targetId: editorName.trim(),
          });
        }
      }
      setShowEditor(false);
      await load();
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Publish ─── */
  const publishTemplate = async (t: LeaseTemplate) => {
    // Validate anchors
    const errors = validateAnchors(t.templateBody, t.signatureSchema);
    if (errors.length > 0) {
      alert(`Cannot publish:\n${errors.join('\n')}`);
      return;
    }
    if (t.signatureSchema.length === 0) {
      alert('Cannot publish a template with no signature/date/initial anchors.');
      return;
    }
    if (!confirm(`Publish "${t.name}" v${t.version}? This locks the template body and fields.`)) return;

    try {
      await leaseTemplateService.update(t.id, { status: 'published' });
      if (adminUser) {
        await activityLogService.create({
          actorUid: adminUser.uid,
          action: 'template_published',
          targetType: 'document',
          targetId: t.id,
          metadata: { name: t.name, version: t.version },
        });
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to publish');
    }
  };

  /* ─── Archive ─── */
  const archiveTemplate = async (t: LeaseTemplate) => {
    if (!confirm(`Archive "${t.name}" v${t.version}?`)) return;
    try {
      await leaseTemplateService.update(t.id, { status: 'archived' });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive');
    }
  };

  /* ─── Delete draft ─── */
  const deleteDraft = async (t: LeaseTemplate) => {
    if (t.status !== 'draft') return;
    if (!confirm(`Delete draft "${t.name}"?`)) return;
    try {
      await leaseTemplateService.delete(t.id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  /* ─── Validate current body ─── */
  const validateCurrent = () => {
    const anchors = extractAnchors(editorBody);
    const sigFields = buildSignatureSchemaFromAnchors(anchors);
    const errors = validateAnchors(editorBody, sigFields);
    if (errors.length === 0 && sigFields.length > 0) {
      setValidationErrors(['✓ All anchors valid']);
    } else if (sigFields.length === 0) {
      setValidationErrors(['No anchors found in template body']);
    } else {
      setValidationErrors(errors);
    }
  };

  /* ─── Render ─── */
  if (showEditor) {
    return (
      <div className="page lease-templates-page">
        <div className="page-header">
          <div>
            <h1><FileText size={24} /> {editing ? 'Edit Template' : 'New Lease Template'}</h1>
            <p>{editing ? `Editing: ${editing.name} v${editing.version}` : 'Create a new lease template with placeholders and signature anchors'}</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={() => setShowEditor(false)}><X size={16} /> Cancel</button>
            <button className="btn btn-primary" onClick={saveDraft} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save Draft'}
            </button>
          </div>
        </div>

        {editorError && (
          <div className="alert alert-error"><AlertTriangle size={16} /> {editorError}</div>
        )}

        <div className="editor-meta-row">
          <div className="form-group">
            <label className="form-label">Template Name</label>
            <input type="text" className="form-input" value={editorName} onChange={e => setEditorName(e.target.value)} placeholder="e.g. AZ Residential Lease" />
          </div>
          <div className="form-group" style={{ maxWidth: 120 }}>
            <label className="form-label">Version</label>
            <input type="text" className="form-input" value={editorVersion} onChange={e => setEditorVersion(e.target.value)} placeholder="1.0.0" />
          </div>
          <div className="form-group" style={{ alignSelf: 'flex-end' }}>
            <div className="editor-mode-toggle">
              <button className={editorMode === 'source' ? 'active' : ''} onClick={() => setEditorMode('source')}><Code size={14} /> Source</button>
              <button className={editorMode === 'split' ? 'active' : ''} onClick={() => setEditorMode('split')}><Columns size={14} /> Split</button>
              <button className={editorMode === 'preview' ? 'active' : ''} onClick={() => setEditorMode('preview')}><Eye size={14} /> Preview</button>
            </div>
          </div>
        </div>

        <div className={`editor-layout editor-layout-${editorMode}`}>
          {(editorMode === 'source' || editorMode === 'split') && (
            <div className="editor-source">
              <textarea
                className="template-textarea"
                value={editorBody}
                onChange={e => { setEditorBody(e.target.value); parseBody(e.target.value); }}
                spellCheck={false}
                placeholder="Paste or write your lease template HTML here…"
              />
            </div>
          )}
          {(editorMode === 'preview' || editorMode === 'split') && (
            <div className="editor-preview">
              <div className="preview-label">Preview</div>
              <div
                className="template-preview-content"
                dangerouslySetInnerHTML={{ __html: editorBody }}
              />
            </div>
          )}
        </div>

        {/* Detected fields + anchors */}
        <div className="detected-fields-row">
          <div className="detected-panel">
            <h3>Detected Placeholders ({editorFields.length})</h3>
            {editorFields.length === 0 ? (
              <p className="muted">No {'{{PLACEHOLDER}}'} variables found</p>
            ) : (
              <div className="field-tags">
                {editorFields.map(f => (
                  <span key={f.key} className="field-tag">{`{{${f.key}}}`} <span className="tag-type">{f.type}</span></span>
                ))}
              </div>
            )}
          </div>
          <div className="detected-panel">
            <h3>Detected Anchors ({editorSigFields.length})</h3>
            {editorSigFields.length === 0 ? (
              <p className="muted">No [[ANCHOR]] fields found</p>
            ) : (
              <div className="field-tags">
                {editorSigFields.map(f => (
                  <span key={f.id} className={`field-tag anchor-${f.type}`}>{f.anchor} <span className="tag-type">{f.role}</span></span>
                ))}
              </div>
            )}
            <button className="btn btn-ghost btn-xs" style={{ marginTop: 8 }} onClick={validateCurrent}>Validate Anchors</button>
            {validationErrors.length > 0 && (
              <div className="validation-output">
                {validationErrors.map((e, i) => (
                  <div key={i} className={e.startsWith('✓') ? 'valid' : 'invalid'}>{e}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page lease-templates-page">
      <div className="page-header">
        <div>
          <h1><FileText size={24} /> Lease Templates</h1>
          <p>Create and manage versioned lease templates with placeholders and signature fields</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCw size={16} /></button>
          <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> New Template</button>
        </div>
      </div>

      <div className="filters-row">
        <div className="search-box">
          <Search size={16} />
          <input type="text" placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><RefreshCw size={24} className="spinner" /> Loading templates…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>No lease templates yet</h3>
          <p>Create your first template to start generating leases.</p>
          <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Create Template</button>
        </div>
      ) : (
        <div className="templates-grid">
          {filtered.map(t => (
            <div key={t.id} className="template-card">
              <div className="template-card-header">
                <div>
                  <h3>{t.name}</h3>
                  <span className="template-version">v{t.version}</span>
                </div>
                <span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status}</span>
              </div>
              <div className="template-card-meta">
                <div><span className="meta-label">Format:</span> {t.templateFormat.toUpperCase()}</div>
                <div><span className="meta-label">Placeholders:</span> {t.fieldSchema.length}</div>
                <div><span className="meta-label">Anchors:</span> {t.signatureSchema.length}</div>
                <div><span className="meta-label">Updated:</span> {fmtDate(t.updatedAt)}</div>
              </div>
              <div className="template-card-actions">
                {t.status === 'draft' && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}><Edit size={14} /> Edit</button>
                    <button className="btn btn-primary btn-sm" onClick={() => publishTemplate(t)}><CheckCircle size={14} /> Publish</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteDraft(t)}><Trash2 size={14} /></button>
                  </>
                )}
                {t.status === 'published' && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => cloneToDraft(t)}><Copy size={14} /> New Version</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => archiveTemplate(t)}><Archive size={14} /> Archive</button>
                  </>
                )}
                {t.status === 'archived' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => cloneToDraft(t)}><Copy size={14} /> Clone to Draft</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
