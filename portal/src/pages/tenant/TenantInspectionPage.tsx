import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, Loader2, AlertCircle, CheckCircle, Save, Send,
} from 'lucide-react';
import { useAuth } from '../../contexts';
import {
  inspectionService,
  generatedLeaseService,
} from '../../lib/firebase/firestore';
import { isFirebaseConfigured } from '../../lib/firebase/config';
import type {
  MoveInInspection,
  InspectionFieldResponse,
  GeneratedLease,
  SignatureFieldDef,
} from '../../types';
import './TenantInspection.css';

export function TenantInspectionPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inspection, setInspection] = useState<MoveInInspection | null>(null);
  const [inspectionFields, setInspectionFields] = useState<SignatureFieldDef[]>([]);
  const [genLease, setGenLease] = useState<GeneratedLease | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /* ─── Load inspection data ─── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!isFirebaseConfigured || !user) return;

      // Find the tenant's generated lease
      const genLeases = await generatedLeaseService.getByTenant(user.uid);
      const active = genLeases.find(g =>
        g.signingStatus === 'sent' || g.signingStatus === 'viewed' || g.signingStatus === 'signed' || g.signingStatus === 'generated'
      );
      if (active) {
        setGenLease(active);

        // Extract inspection fields directly from generated lease signatureFields
        // (tenants cannot read leaseTemplates collection — admin-only)
        const inspFields: SignatureFieldDef[] = active.signatureFields
          .filter(sf => sf.phase === 'move_in_inspection')
          .map(sf => ({
            id: sf.fieldId,
            type: sf.type,
            role: sf.role,
            anchor: '', // not needed for form rendering
            required: sf.required,
            displayLabel: sf.displayLabel,
            ownerRole: sf.ownerRole,
            phase: sf.phase,
          }));
        setInspectionFields(inspFields);
      }

      // Check for existing inspection record
      const existing = await inspectionService.getByTenant(user.uid);
      if (existing.length > 0) {
        const insp = existing[0];
        setInspection(insp);
        // Load existing responses
        const vals: Record<string, string> = {};
        for (const r of insp.responses) {
          vals[r.fieldId] = r.value;
        }
        setResponses(vals);
      }
    } catch (err) {
      console.error('Failed to load inspection:', err);
      setError('Failed to load inspection data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const isSubmitted = inspection?.status === 'submitted';

  /* ─── Save progress ─── */
  const handleSave = async (submit: boolean) => {
    if (!user || !genLease) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const fieldResponses: InspectionFieldResponse[] = inspectionFields.map(f => ({
        fieldId: f.id,
        type: f.type as 'check' | 'text' | 'date',
        label: f.displayLabel,
        value: responses[f.id] || (f.type === 'check' ? 'false' : ''),
        completedAt: new Date(),
      }));

      const status = submit ? 'submitted' as const : 'in_progress' as const;

      if (inspection) {
        await inspectionService.update(inspection.id, {
          responses: fieldResponses,
          status,
          ...(submit ? { submittedAt: new Date() } : {}),
        });
      } else {
        const id = await inspectionService.create({
          leaseId: genLease.leaseId,
          tenantUid: user.uid,
          propertyId: genLease.propertyId,
          status,
          responses: fieldResponses,
          ...(submit ? { submittedAt: new Date() } : {}),
        });
        setInspection({ id, leaseId: genLease.leaseId, tenantUid: user.uid, propertyId: genLease.propertyId, status, responses: fieldResponses, createdAt: new Date(), updatedAt: new Date() });
      }

      setSuccess(submit ? 'Inspection submitted successfully!' : 'Progress saved.');
      if (submit) await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="page"><div className="loading-container"><Loader2 size={32} className="spinner" /><p>Loading inspection…</p></div></div>
    );
  }

  if (inspectionFields.length === 0) {
    return (
      <div className="page tenant-inspection-page">
        <div className="page-header">
          <h1><ClipboardCheck size={24} /> Move-in Inspection</h1>
          <p>Complete your move-in inspection checklist</p>
        </div>
        <div className="empty-state">
          <ClipboardCheck size={48} />
          <h3>No Inspection Checklist Available</h3>
          <p>Your lease does not include a move-in inspection checklist, or no lease has been sent yet.</p>
        </div>
      </div>
    );
  }

  // Group fields by category (e.g., "bathrooms", "carpeting") 
  const checkFields = inspectionFields.filter(f => f.type === 'check');
  const textFields = inspectionFields.filter(f => f.type === 'text');
  const dateFields = inspectionFields.filter(f => f.type === 'date');

  // Group check+text by common prefix using fieldId
  // fieldId format: "check_move_in_bathrooms_ok_N" or "text_move_in_bathrooms_comments_N"
  const categories = new Map<string, { check?: SignatureFieldDef; text?: SignatureFieldDef }>();
  for (const f of [...checkFields, ...textFields]) {
    // Extract the base area name from the fieldId
    // e.g. "check_move_in_bathrooms_ok_5" → strip type prefix + namespace + suffix index
    const idParts = f.id.split('_');
    // Remove first part (check/text), 'move' and 'in' namespace parts, and last part (index)
    // Then remove _ok / _comments suffix
    const withoutPrefix = idParts.slice(1).slice(0, -1).join('_'); // "move_in_bathrooms_ok"
    const withoutNs = withoutPrefix.replace(/^move_in_/, '').replace(/^inspection_/, '');
    const base = withoutNs.replace(/_(ok|comments|satisfactory)$/, '');
    if (!categories.has(base)) categories.set(base, {});
    const cat = categories.get(base)!;
    if (f.type === 'check') cat.check = f;
    else if (f.type === 'text') cat.text = f;
  }

  return (
    <div className="page tenant-inspection-page">
      <div className="page-header">
        <div>
          <h1><ClipboardCheck size={24} /> Move-in Inspection</h1>
          <p>Complete your move-in condition checklist (optional)</p>
        </div>
        {isSubmitted && (
          <span className="badge badge-success"><CheckCircle size={14} /> Submitted</span>
        )}
      </div>

      {error && (
        <div className="alert alert-error"><AlertCircle size={16} /> {error}<button onClick={() => setError(null)}>&times;</button></div>
      )}
      {success && (
        <div className="alert alert-success"><CheckCircle size={16} /> {success}<button onClick={() => setSuccess(null)}>&times;</button></div>
      )}

      <div className="inspection-card">
        <p className="inspection-note">
          This inspection documents the condition of the property when you move in.
          Completing this checklist protects your security deposit. It does <strong>not</strong> block lease signing or rent payments.
        </p>

        {/* Date field */}
        {dateFields.map(f => (
          <div key={f.id} className="form-group" style={{ maxWidth: '300px', marginBottom: '1.5rem' }}>
            <label className="form-label">{f.displayLabel}</label>
            <input
              type="date"
              className="form-input"
              value={responses[f.id] || ''}
              onChange={e => setResponses(prev => ({ ...prev, [f.id]: e.target.value }))}
              disabled={isSubmitted}
            />
          </div>
        ))}

        {/* Category rows */}
        <div className="inspection-grid">
          <div className="inspection-grid-header">
            <span>Area</span>
            <span>Satisfactory</span>
            <span>Comments</span>
          </div>
          {Array.from(categories.entries()).map(([base, { check, text }]) => {
            const label = base.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return (
              <div key={base} className="inspection-row">
                <span className="inspection-area-label">{label}</span>
                <div className="inspection-check-cell">
                  {check && (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={responses[check.id] === 'true'}
                        onChange={e => setResponses(prev => ({ ...prev, [check.id]: e.target.checked ? 'true' : 'false' }))}
                        disabled={isSubmitted}
                      />
                      OK
                    </label>
                  )}
                </div>
                <div className="inspection-comment-cell">
                  {text && (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Notes…"
                      value={responses[text.id] || ''}
                      onChange={e => setResponses(prev => ({ ...prev, [text.id]: e.target.value }))}
                      disabled={isSubmitted}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Standalone text fields not paired with a check (e.g. general_notes) */}
          {textFields.filter(f => {
            const idParts = f.id.split('_');
            const withoutPrefix = idParts.slice(1).slice(0, -1).join('_');
            const withoutNs = withoutPrefix.replace(/^move_in_/, '').replace(/^inspection_/, '');
            const base = withoutNs.replace(/_(ok|comments|satisfactory)$/, '');
            return !categories.has(base) || !categories.get(base)?.check;
          }).filter(f => {
            // Exclude those already shown in categories as paired comments
            const idParts = f.id.split('_');
            const withoutPrefix = idParts.slice(1).slice(0, -1).join('_');
            return !withoutPrefix.endsWith('_comments');
          }).map(f => (
            <div key={f.id} className="inspection-row">
              <span className="inspection-area-label">{f.displayLabel}</span>
              <div className="inspection-check-cell" />
              <div className="inspection-comment-cell" style={{ gridColumn: 'span 1' }}>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Enter notes…"
                  value={responses[f.id] || ''}
                  onChange={e => setResponses(prev => ({ ...prev, [f.id]: e.target.value }))}
                  disabled={isSubmitted}
                />
              </div>
            </div>
          ))}
        </div>

        {!isSubmitted && (
          <div className="inspection-actions">
            <button
              className="btn btn-outline"
              disabled={saving}
              onClick={() => handleSave(false)}
            >
              {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />}
              Save Progress
            </button>
            <button
              className="btn btn-primary"
              disabled={saving}
              onClick={() => handleSave(true)}
            >
              {saving ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
              Submit Inspection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
