import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText, Download, Send, RefreshCw, AlertTriangle,
  CheckCircle, Loader2, Clock, Pen, XCircle,
} from 'lucide-react';
import {
  leaseTemplateService,
  generatedLeaseService,
  leaseService,
  propertyService,
  userService,
  activityLogService,
} from '../../lib/firebase/firestore';
import { portalDocumentService } from '../../lib/firebase/rentStatements';
import { createAdminAlert } from '../../lib/firebase/adminAlerts';
import { uploadFile, getFileUrl } from '../../lib/firebase/storage';
import { useAuth } from '../../contexts';
import { generateLeasePdf } from '../../lib/leaseGenerator';
import type {
  LeaseTemplate,
  Lease,
  Property,
  UserProfile,
  GeneratedLease,
  LeaseSigningStatus,
} from '../../types';
import './GenerateLease.css';

/* ─── Helpers ─── */
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SIGNING_BADGE: Record<LeaseSigningStatus, { cls: string; label: string }> = {
  not_generated: { cls: 'badge-gray', label: 'Not Generated' },
  generated: { cls: 'badge-info', label: 'Generated' },
  sent: { cls: 'badge-warning', label: 'Sent' },
  viewed: { cls: 'badge-info', label: 'Viewed' },
  signed: { cls: 'badge-success', label: 'Signed' },
  voided: { cls: 'badge-gray', label: 'Voided' },
};

/* ─── Component ─── */
export function GenerateLeasePage() {
  const { user: adminUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Pre-selected
  const presetTenantUid = searchParams.get('tenantUid') || '';
  const presetLeaseId = searchParams.get('leaseId') || '';

  // Data
  const [templates, setTemplates] = useState<LeaseTemplate[]>([]);
  const [tenants, setTenants] = useState<UserProfile[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [generated, setGenerated] = useState<GeneratedLease[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate form state
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTenantUid, setSelectedTenantUid] = useState(presetTenantUid);
  const [selectedLeaseId, setSelectedLeaseId] = useState(presetLeaseId);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuccess, setGenSuccess] = useState<string | null>(null);

  // View tab
  const [tab, setTab] = useState<'generate' | 'history'>('generate');

  /* ─── Load all data ─── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes, tenantRes, leaseRes, propRes, genRes] = await Promise.allSettled([
        leaseTemplateService.getPublished().catch(() =>
          // Fallback: if composite index isn't ready, fetch all and filter client-side
          leaseTemplateService.getAll().then(all => all.filter(t => t.status === 'published'))
        ),
        userService.getAll(),
        leaseService.getAll(),
        propertyService.getAll(),
        generatedLeaseService.getAll(),
      ]);
      let loadedTemplates: LeaseTemplate[] = [];
      if (tplRes.status === 'fulfilled') { loadedTemplates = tplRes.value; setTemplates(loadedTemplates); }
      else console.error('Failed to load templates:', (tplRes as PromiseRejectedResult).reason);
      if (tenantRes.status === 'fulfilled') setTenants(tenantRes.value.filter((u: UserProfile) => u.role === 'tenant'));
      if (leaseRes.status === 'fulfilled') setLeases(leaseRes.value);
      if (propRes.status === 'fulfilled') setProperties(propRes.value);
      if (genRes.status === 'fulfilled') setGenerated(genRes.value);

      // Auto-select template when navigating with presets and only one template exists
      if (presetTenantUid && presetLeaseId && loadedTemplates.length === 1 && !selectedTemplateId) {
        setSelectedTemplateId(loadedTemplates[0].id);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ─── Derived state ─── */
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const selectedTenant = tenants.find(t => t.uid === selectedTenantUid);
  const selectedLease = leases.find(l => l.id === selectedLeaseId);
  const selectedProperty = selectedLease ? properties.find(p => p.id === selectedLease.propertyId) : null;

  // Tenant's leases
  const tenantLeases = useMemo(() =>
    leases.filter(l => l.tenantUid === selectedTenantUid || (l.tenantIds && l.tenantIds.includes(selectedTenantUid))),
    [leases, selectedTenantUid]
  );

  // Auto-fill field values when template/tenant/lease change
  // Include ALL fields — admin fills them, tenant never fills placeholders
  useEffect(() => {
    if (!selectedTemplate) return;
    const vals: Record<string, string> = {};
    const occupants = selectedLease?.occupants ?? [];
    for (const field of selectedTemplate.fieldSchema) {
      // Try to auto-fill from tenant/lease/property data
      const k = field.key;
      // Tenant names
      if ((k === 'TENANT_FULL_NAME' || k === 'TENANT_1_NAME' || k === 'TENANT_NAME') && selectedTenant) vals[k] = selectedTenant.displayName;
      else if (k === 'TENANT_1_EMAIL' && selectedTenant) vals[k] = selectedTenant.email;
      else if (k === 'TENANT_1_PHONE' && selectedTenant?.phone) vals[k] = selectedTenant.phone;
      // Additional tenants from lease occupants (index 0-based for occupants, 2-4 for tenants)
      else if (/^TENANT_[2-4]_(NAME|EMAIL|PHONE)$/.test(k)) {
        const idx = parseInt(k.charAt(7)) - 2; // TENANT_2 → occupant[0], TENANT_3 → occupant[1], etc.
        const occ = occupants[idx];
        if (occ) {
          if (k.endsWith('_NAME')) vals[k] = occ.fullName;
          else if (k.endsWith('_EMAIL')) vals[k] = occ.email || '';
          else if (k.endsWith('_PHONE')) vals[k] = occ.phone || '';
        } else vals[k] = fieldValues[k] || '';
      }
      // Occupant aliases (OCCUPANT_1_NAME = primary tenant, OCCUPANT_2_NAME = first occupant, etc.)
      else if (/^OCCUPANT_\d+_/.test(k)) {
        const idx = parseInt(k.split('_')[1]) - 1;
        if (idx === 0 && selectedTenant) {
          if (k.endsWith('_NAME')) vals[k] = selectedTenant.displayName;
          else if (k.endsWith('_EMAIL')) vals[k] = selectedTenant.email;
          else if (k.endsWith('_PHONE')) vals[k] = selectedTenant.phone || '';
        } else {
          const occ = occupants[idx - 1]; // OCCUPANT_2 → occupants[0]
          if (occ) {
            if (k.endsWith('_NAME')) vals[k] = occ.fullName;
            else if (k.endsWith('_EMAIL')) vals[k] = occ.email || '';
            else if (k.endsWith('_PHONE')) vals[k] = occ.phone || '';
          } else vals[k] = fieldValues[k] || '';
        }
      }
      // Property
      else if (k === 'PROPERTY_ADDRESS' && selectedProperty) vals[k] = `${selectedProperty.address}${selectedProperty.unit ? ` #${selectedProperty.unit}` : ''}, ${selectedProperty.city}, ${selectedProperty.state} ${selectedProperty.zip}`;
      else if (k === 'PROPERTY_CITY' && selectedProperty) vals[k] = selectedProperty.city;
      else if (k === 'PROPERTY_STATE' && selectedProperty) vals[k] = selectedProperty.state;
      else if (k === 'PROPERTY_ZIP' && selectedProperty) vals[k] = selectedProperty.zip;
      // Lease dates + money
      else if ((k === 'LEASE_START_DATE' || k === 'START_DATE') && selectedLease) vals[k] = new Date(selectedLease.startDate).toLocaleDateString('en-US');
      else if ((k === 'LEASE_END_DATE' || k === 'END_DATE') && selectedLease?.endDate) vals[k] = new Date(selectedLease.endDate).toLocaleDateString('en-US');
      else if ((k === 'RENT_AMOUNT' || k === 'MONTHLY_RENT') && selectedLease) vals[k] = `$${selectedLease.monthlyRent.toLocaleString()}`;
      else if ((k === 'DEPOSIT_AMOUNT' || k === 'SECURITY_DEPOSIT') && selectedLease) vals[k] = `$${selectedLease.securityDeposit.toLocaleString()}`;
      else if (k === 'OCCUPANTS' && occupants.length) vals[k] = [selectedTenant?.displayName, ...occupants.map(o => o.fullName)].filter(Boolean).join(', ');
      else if (field.default) vals[k] = field.default;
      else vals[k] = fieldValues[k] || '';
    }
    setFieldValues(vals);
  // We intentionally only re-run when these IDs change, not on every fieldValues change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, selectedTenantUid, selectedLeaseId, selectedTemplate, selectedTenant, selectedLease, selectedProperty]);

  /* ─── Generate ─── */
  const handleGenerate = async () => {
    if (!selectedTemplate || !selectedTenantUid || !selectedLeaseId) {
      setGenError('Select a template, tenant, and lease first.');
      return;
    }
    if (!selectedLease) {
      setGenError('Selected lease not found. Make sure the lease exists and try again.');
      return;
    }

    // Check required fields (TENANT_2-4 fields are always optional)
    for (const f of selectedTemplate.fieldSchema) {
      const isOptionalTenant = /^TENANT_[2-4]/.test(f.key) || /^OCCUPANT_[2-9]/.test(f.key);
      if (f.required && !isOptionalTenant && !fieldValues[f.key]?.trim()) {
        setGenError(`Required field "${f.label}" is empty.`);
        return;
      }
    }

    setGenerating(true);
    setGenError(null);
    setGenSuccess(null);

    try {
      // Generate PDF
      const { pdfBytes, fieldMap } = await generateLeasePdf(selectedTemplate, fieldValues);

      // Upload original to Storage
      const storagePath = `generated-leases/${selectedLeaseId}/original_${Date.now()}.pdf`;
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'lease_original.pdf', { type: 'application/pdf' });
      await uploadFile(storagePath, file);

      // Create generatedLease record
      const genId = await generatedLeaseService.create({
        leaseId: selectedLeaseId,
        templateId: selectedTemplate.id,
        templateVersion: selectedTemplate.version,
        tenantUid: selectedTenantUid,
        propertyId: selectedLease.propertyId,
        generatedByUid: adminUser!.uid,
        generatedAt: new Date(),
        fieldValues,
        signingStatus: 'generated',
        signatureFields: fieldMap,
        pdfOriginalPath: storagePath,
      });

      // Create portal document for tracking
      const docId = await portalDocumentService.create({
        ownerUid: selectedTenantUid,
        uploadedByUid: adminUser!.uid,
        category: 'lease',
        fileName: `Lease_${selectedTemplate.name}_v${selectedTemplate.version}.pdf`,
        originalFilePath: storagePath,
        status: 'uploaded',
        requiresSignature: true,
        roleScope: 'tenant',
      });

      // Link portal doc to generated lease
      await generatedLeaseService.update(genId, { portalDocumentId: docId });

      // Log activity
      await activityLogService.create({
        actorUid: adminUser!.uid,
        targetUid: selectedTenantUid,
        action: 'lease_generated',
        targetType: 'document',
        targetId: genId,
        metadata: {
          templateName: selectedTemplate.name,
          templateVersion: selectedTemplate.version,
          leaseId: selectedLeaseId,
        },
      });

      createAdminAlert({
        type: 'general',
        title: 'Lease Generated',
        message: `Lease generated from template "${selectedTemplate.name}" for ${selectedTenant?.displayName || 'tenant'}.`,
        relatedId: genId,
        relatedType: 'lease',
      });
      setGenSuccess(`Lease generated successfully (ID: ${genId.slice(0, 8)}…). You can now send it for signature.`);
      await loadData();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  /* ─── Send for signature ─── */
  const sendForSignature = async (gen: GeneratedLease) => {
    try {
      await generatedLeaseService.update(gen.id, { signingStatus: 'sent' });
      if (gen.portalDocumentId) {
        await portalDocumentService.update(gen.portalDocumentId, { status: 'pending_signature' });
      }
      // Create alert for tenant
      try {
        const { alertService } = await import('../../lib/firebase/firestore');
        await alertService.create({
          userId: gen.tenantUid,
          type: 'general',
          title: 'Lease Ready for Signature',
          message: 'Your lease agreement is ready for electronic signature. Please review and sign at your earliest convenience.',
          relatedId: gen.id,
          relatedType: 'lease',
          read: false,
          archived: false,
        });
      } catch (alertErr) {
        console.warn('Failed to create lease alert:', alertErr);
      }
      await activityLogService.create({
        actorUid: adminUser!.uid,
        targetUid: gen.tenantUid,
        action: 'lease_sent_for_signature',
        targetType: 'document',
        targetId: gen.id,
      });
      createAdminAlert({
        type: 'general',
        title: 'Lease Sent for Signature',
        message: `Lease document sent to tenant for signature.`,
        relatedId: gen.id,
        relatedType: 'lease',
      });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send');
    }
  };

  /* ─── Void a generated lease ─── */
  const voidGeneratedLease = async (gen: GeneratedLease) => {
    const label = gen.signingStatus === 'signed' ? 'void this signed lease' : 'void this generated lease';
    if (!confirm(`Are you sure you want to ${label}? The tenant will no longer be able to sign it.`)) return;
    try {
      await generatedLeaseService.update(gen.id, { signingStatus: 'voided' });
      if (gen.portalDocumentId) {
        await portalDocumentService.update(gen.portalDocumentId, { status: 'void' as const });
      }
      createAdminAlert({
        type: 'general',
        title: 'Generated Lease Voided',
        message: `A generated lease was voided (was: ${gen.signingStatus}).`,
        relatedId: gen.id,
        relatedType: 'lease',
      });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to void');
    }
  };

  /* ─── Download ─── */
  const downloadPdf = async (path: string, filename: string) => {
    try {
      const url = await getFileUrl(path);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.click();
    } catch (err) {
      alert('Failed to download: ' + (err instanceof Error ? err.message : 'unknown error'));
    }
  };

  /* ─── Render ─── */
  if (loading) {
    return <div className="page"><div className="loading-container"><Loader2 size={32} className="spinner" /> Loading…</div></div>;
  }

  return (
    <div className="page generate-lease-page">
      <div className="page-header">
        <div>
          <h1><FileText size={24} /> Generate Lease</h1>
          <p>Generate tenant-specific lease documents from published templates</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={loadData}><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-row">
        <button className={`tab-btn ${tab === 'generate' ? 'active' : ''}`} onClick={() => setTab('generate')}>
          <Pen size={16} /> Generate New
        </button>
        <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <Clock size={16} /> Generated Leases ({generated.length})
        </button>
      </div>

      {tab === 'generate' && (
        <div className="generate-form">
          {genError && <div className="alert alert-error"><AlertTriangle size={16} /> {genError}</div>}
          {genSuccess && <div className="alert alert-success"><CheckCircle size={16} /> {genSuccess}</div>}

          {/* Step 1: Select template */}
          <div className="form-section">
            <h3>1. Select Template</h3>
            {templates.length === 0 ? (
              <div className="alert alert-warning"><AlertTriangle size={16} /> No published templates. <button className="btn btn-link" onClick={() => navigate('/admin/lease-templates')}>Create one</button></div>
            ) : (
              <select className="form-select" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                <option value="">Choose a template…</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} v{t.version}</option>
                ))}
              </select>
            )}
          </div>

          {/* Step 2: Select tenant + lease */}
          <div className="form-section">
            <h3>2. Select Tenant &amp; Lease</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Tenant</label>
                <select className="form-select" value={selectedTenantUid} onChange={e => { setSelectedTenantUid(e.target.value); setSelectedLeaseId(''); }}>
                  <option value="">Choose a tenant…</option>
                  {tenants.map(t => (
                    <option key={t.uid} value={t.uid}>{t.displayName} ({t.email})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Lease</label>
                <select className="form-select" value={selectedLeaseId} onChange={e => setSelectedLeaseId(e.target.value)} disabled={!selectedTenantUid}>
                  <option value="">Choose a lease…</option>
                  {tenantLeases.map(l => {
                    const prop = properties.find(p => p.id === l.propertyId);
                    return (
                      <option key={l.id} value={l.id}>
                        {prop ? `${prop.address}${prop.unit ? ` #${prop.unit}` : ''}` : l.propertyId.slice(0, 8)} — {l.status} — ${l.monthlyRent}/mo
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Step 3: Fill variables */}
          {selectedTemplate && selectedTenantUid && selectedLeaseId && (
            <>
            <div className="form-section">
              <h3>3. Fill Lease Variables</h3>
              <p className="form-hint">Auto-filled from lease data. Review and adjust as needed.</p>
              <div className="variable-grid">
                {selectedTemplate.fieldSchema.filter(f => !f.ownerRole || f.ownerRole === 'admin').map(f => {
                  const isOptionalTenant = /^TENANT_[2-4]/.test(f.key) || /^OCCUPANT_[2-9]/.test(f.key);
                  const isRequired = f.required && !isOptionalTenant;
                  return (
                  <div key={f.key} className="form-group">
                    <label className="form-label">
                      {f.label} {isRequired && <span className="required">*</span>}
                      <span className="field-key-hint">{`{{${f.key}}}`}</span>
                    </label>
                    {f.type === 'boolean' ? (
                      <label className="checkbox-label">
                        <input type="checkbox" checked={fieldValues[f.key] === 'Yes'} onChange={e => setFieldValues(v => ({ ...v, [f.key]: e.target.checked ? 'Yes' : 'No' }))} />
                        {fieldValues[f.key] === 'Yes' ? 'Yes' : 'No'}
                      </label>
                    ) : f.type === 'list' ? (
                      <textarea
                        className="form-input"
                        rows={2}
                        value={fieldValues[f.key] || ''}
                        onChange={e => setFieldValues(v => ({ ...v, [f.key]: e.target.value }))}
                        placeholder="Comma-separated values"
                      />
                    ) : (
                      <input
                        type={f.type === 'date' ? 'date' : f.type === 'money' ? 'text' : 'text'}
                        className="form-input"
                        value={fieldValues[f.key] || ''}
                        onChange={e => setFieldValues(v => ({ ...v, [f.key]: e.target.value }))}
                      />
                    )}
                  </div>
                  );
                })}
              </div>

              {/* Signature fields preview (signing phase only) */}
              {(() => {
                const signingFields = selectedTemplate.signatureSchema.filter(s => s.phase !== 'move_in_inspection');
                const inspectionFields = selectedTemplate.signatureSchema.filter(s => s.phase === 'move_in_inspection');
                return (
                  <>
                    <div className="sig-fields-preview">
                      <h4>Signature / Date / Initial Fields ({signingFields.length})</h4>
                      <div className="sig-field-list">
                        {signingFields.map(s => (
                          <div key={s.id} className="sig-field-item">
                            <span className={`sig-type-badge sig-type-${s.type}`}>{s.type}</span>
                            <span>{s.displayLabel}</span>
                            <span className="sig-role">{s.role}</span>
                            {s.required && <span className="required">required</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    {inspectionFields.length > 0 && (
                      <div className="sig-fields-preview" style={{ opacity: 0.7 }}>
                        <h4>Move-in Inspection Fields ({inspectionFields.length}) — tenant completes later</h4>
                        <div className="sig-field-list">
                          {inspectionFields.map(s => (
                            <div key={s.id} className="sig-field-item">
                              <span className={`sig-type-badge sig-type-${s.type}`}>{s.type}</span>
                              <span>{s.displayLabel}</span>
                              <span className="sig-role" style={{ color: 'var(--text-muted)'}}>optional</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

              <div className="generate-actions">
                <button className="btn btn-primary btn-lg" onClick={handleGenerate} disabled={generating}>
                  {generating ? <><Loader2 size={16} className="spinner" /> Generating…</> : <><FileText size={16} /> Generate Lease PDF</>}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="generated-list">
          {generated.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>No generated leases yet</h3>
              <p>Generate your first lease from the "Generate New" tab.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Template</th>
                  <th>Generated</th>
                  <th>Status</th>
                  <th>Signed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {generated.map(g => {
                  const tenant = tenants.find(t => t.uid === g.tenantUid);
                  const badge = SIGNING_BADGE[g.signingStatus];
                  return (
                    <tr key={g.id}>
                      <td>{tenant?.displayName || g.tenantUid.slice(0, 8)}</td>
                      <td><span className="template-badge">v{g.templateVersion}</span></td>
                      <td>{fmtDate(g.generatedAt)}</td>
                      <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                      <td>{g.signedAt ? fmtDate(g.signedAt) : '—'}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-ghost btn-xs" title="Download original" onClick={() => downloadPdf(g.pdfOriginalPath, `lease_original_${g.id.slice(0, 8)}.pdf`)}>
                            <Download size={14} /> Original
                          </button>
                          {g.pdfSignedPath && (
                            <button className="btn btn-ghost btn-xs" title="Download signed" onClick={() => downloadPdf(g.pdfSignedPath!, `lease_signed_${g.id.slice(0, 8)}.pdf`)}>
                              <Download size={14} /> Signed
                            </button>
                          )}
                          {g.signingStatus === 'generated' && (
                            <button className="btn btn-primary btn-xs" onClick={() => sendForSignature(g)}>
                              <Send size={14} /> Send
                            </button>
                          )}
                          {(g.signingStatus === 'sent' || g.signingStatus === 'viewed') && (
                            <button className="btn btn-outline btn-xs" onClick={() => sendForSignature(g)}>
                              <Send size={14} /> Resend
                            </button>
                          )}
                          {g.signingStatus === 'signed' && (
                            <span className="signed-check"><CheckCircle size={14} /> Complete</span>
                          )}
                          {g.signingStatus !== 'not_generated' && g.signingStatus !== 'voided' && (
                            <button className="btn btn-outline btn-xs" style={{ color: '#dc2626', borderColor: '#dc2626' }} onClick={() => voidGeneratedLease(g)} title="Void this lease">
                              <XCircle size={14} /> Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
