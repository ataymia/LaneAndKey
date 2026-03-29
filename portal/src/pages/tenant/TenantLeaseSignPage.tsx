import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Pen,
  CheckCircle,
  AlertCircle,
  Download,
  Loader2,
  X,
  Shield,
  Check,
  Calendar,
  Type,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import SignaturePad from 'signature_pad';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getAuth } from 'firebase/auth';
import { useAuth } from '../../contexts';
import { portalDocumentService, isFirebaseConfigured } from '../../lib/firebase';
import { generatedLeaseService } from '../../lib/firebase/firestore';
import { createAdminAlert } from '../../lib/firebase/adminAlerts';
import { uploadFile, getFileUrl } from '../../lib/firebase/storage';
import { applySignaturesToPdf } from '../../lib/leaseGenerator';
import type { PortalDocument, GeneratedLease, LeaseSignatureFieldValue } from '../../types';
import './TenantLease.css';

/* ─── Helpers ─── */
async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Load PDF bytes through same-origin proxy to avoid CORS issues with Firebase Storage */
async function loadPdfBytes(storagePath: string): Promise<Uint8Array> {
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Not authenticated');

  const resp = await fetch('/api/proxy-storage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ storagePath }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Proxy fetch failed (${resp.status}): ${errBody}`);
  }

  return new Uint8Array(await resp.arrayBuffer());
}

/* ─── Component ─── */
export function TenantLeaseSignPage() {
  const { user, userProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);

  const [lease, setLease] = useState<PortalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  // Keep original PDF bytes in memory for preview rebuilds + signing
  const originalPdfBytesRef = useRef<Uint8Array | null>(null);

  // Generated lease (structured signing)
  const [genLease, setGenLease] = useState<GeneratedLease | null>(null);
  const [fieldCompletions, setFieldCompletions] = useState<Record<string, LeaseSignatureFieldValue>>({});
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  // DocuSign-style navigation
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);

  // Signing state
  const [showSignModal, setShowSignModal] = useState(false);
  const [signMode, setSignMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [consent, setConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signSuccess, setSignSuccess] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  const isStructured = !!genLease?.signatureFields?.length;

  /* ─── Compute field completion status ─── */
  const tenantFields = (genLease?.signatureFields ?? []).filter((f) => {
    if (f.role !== 'tenant') return false;
    if (f.phase === 'move_in_inspection') return false;
    return true;
  });
  const requiredTenantFields = tenantFields.filter((f) => f.required !== false);
  const completedCount = requiredTenantFields.filter((f) => fieldCompletions[f.fieldId]?.value).length;
  const allFieldsDone = requiredTenantFields.length > 0 && completedCount === requiredTenantFields.length;

  // Next / prev incomplete for DocuSign-style navigation
  const nextIncompleteIndex = tenantFields.findIndex(
    (f, i) => i > currentFieldIndex && !fieldCompletions[f.fieldId]?.value
  );
  const prevIncompleteIndex = (() => {
    for (let i = currentFieldIndex - 1; i >= 0; i--) {
      if (!fieldCompletions[tenantFields[i]?.fieldId]?.value) return i;
    }
    return -1;
  })();

  /* ─── Load lease document ─── */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (!isFirebaseConfigured || !user) {
          setPageError('Lease documents are unavailable until Firebase is configured and you are signed in.');
          return;
        }
        const docs = await portalDocumentService.getByOwner(user.uid);
        const found = docs.find(
          (d) => d.category === 'lease' && d.requiresSignature && d.status !== 'void'
        );
        if (found) setLease(found);

        // Look for a structured GeneratedLease sent for signing
        const genLeases = await generatedLeaseService.getByTenant(user.uid);
        const sent = genLeases.find(
          (g) => g.signingStatus === 'sent' || g.signingStatus === 'viewed'
        );

        // Determine storage path for PDF
        const storagePath = sent?.pdfOriginalPath || found?.originalFilePath;

        if (storagePath) {
          try {
            // Load PDF bytes via Firebase SDK — bypasses CORS entirely
            const bytes = await loadPdfBytes(storagePath);
            originalPdfBytesRef.current = bytes;
            const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
            setPdfUrl(URL.createObjectURL(blob));
          } catch (pdfErr) {
            console.error('Failed to load PDF via SDK, trying download URL:', pdfErr);
            const path = sent?.pdfOriginalPath || found?.originalFilePath;
            if (path) {
              const url = await getFileUrl(path);
              setPdfUrl(url);
            }
          }
        }

        if (sent) {
          setGenLease(sent);
          if (sent.signingStatus === 'sent') {
            await generatedLeaseService.update(sent.id, { signingStatus: 'viewed' });
            setGenLease({ ...sent, signingStatus: 'viewed' });
          }
          const completions: Record<string, LeaseSignatureFieldValue> = {};
          for (const f of sent.signatureFields ?? []) {
            completions[f.fieldId] = { ...f };
          }
          setFieldCompletions(completions);
        }
      } catch (err) {
        console.error('Error loading lease:', err);
        setPageError('Failed to load lease document.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  /* ─── Rebuild PDF preview when fields change (live updates) ─── */
  useEffect(() => {
    if (!genLease) return;
    const completed = Object.values(fieldCompletions).filter((f) => f.completedAt && f.value);
    if (completed.length === 0) return;

    const origBytes = originalPdfBytesRef.current;
    if (!origBytes) return;

    let cancelled = false;
    (async () => {
      try {
        const updatedBytes = await applySignaturesToPdf(
          origBytes,
          completed,
          userProfile?.displayName || 'Tenant',
        );
        if (cancelled) return;
        if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
        const blob = new Blob([updatedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        setPreviewPdfUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.error('Failed to rebuild PDF preview:', err);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldCompletions, genLease]);

  /* ─── Persist field completions incrementally ─── */
  useEffect(() => {
    if (!genLease) return;
    const completed = Object.values(fieldCompletions).filter((f) => f.completedAt && f.value);
    if (completed.length === 0) return;
    const timer = setTimeout(async () => {
      try {
        const updatedFields = (genLease.signatureFields ?? []).map((f) => {
          const c = fieldCompletions[f.fieldId];
          if (c?.value && c?.completedAt) return { ...f, value: c.value, completedAt: c.completedAt };
          return f;
        });
        await generatedLeaseService.update(genLease.id, { signatureFields: updatedFields });
      } catch (err) {
        console.error('Failed to persist field progress:', err);
      }
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldCompletions]);

  /* ─── Init signature pad ─── */
  const initSigPad = useCallback(() => {
    if (canvasRef.current && !sigPadRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
      sigPadRef.current = new SignaturePad(canvas, {
        penColor: '#1a1a2e',
        backgroundColor: 'rgba(255,255,255,0)',
      });
    }
  }, []);

  useEffect(() => {
    if (showSignModal && signMode === 'draw') {
      const t = setTimeout(initSigPad, 100);
      return () => clearTimeout(t);
    }
    return () => { sigPadRef.current = null; };
  }, [showSignModal, signMode, initSigPad]);

  /* ─── Build signature image ─── */
  async function getSignatureImage(): Promise<Uint8Array | null> {
    if (signMode === 'draw') {
      if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
        setSignError('Please draw your signature.');
        return null;
      }
      const dataUrl = sigPadRef.current.toDataURL('image/png');
      const res = await fetch(dataUrl);
      return new Uint8Array(await res.arrayBuffer());
    } else {
      if (!typedName.trim()) {
        setSignError('Please type your name.');
        return null;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 80;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'italic 36px "Times New Roman", serif';
      ctx.fillStyle = '#1a1a2e';
      ctx.fillText(typedName.trim(), 20, 52);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return null;
      return new Uint8Array(await blob.arrayBuffer());
    }
  }

  /* ─── Auto-advance to next incomplete field after completing one ─── */
  function autoAdvance() {
    setTimeout(() => {
      const idx = tenantFields.findIndex(
        (f, i) => i > currentFieldIndex && !fieldCompletions[f.fieldId]?.value
      );
      if (idx >= 0) setCurrentFieldIndex(idx);
    }, 200);
  }

  /* ─── Complete a single structured field ─── */
  function handleFieldClick(fieldId: string) {
    const field = fieldCompletions[fieldId];
    if (!field) return;
    if (field.type === 'date') {
      setFieldCompletions((prev) => ({
        ...prev,
        [fieldId]: { ...prev[fieldId], value: new Date().toLocaleDateString('en-US'), completedAt: new Date() },
      }));
      autoAdvance();
    } else if (field.type === 'initial') {
      const initials = (userProfile?.displayName || '')
        .split(' ')
        .map((w) => w[0]?.toUpperCase() || '')
        .join('');
      setFieldCompletions((prev) => ({
        ...prev,
        [fieldId]: { ...prev[fieldId], value: initials || 'N/A', completedAt: new Date() },
      }));
      autoAdvance();
    } else {
      setActiveFieldId(fieldId);
      setShowSignModal(true);
    }
  }

  /* ─── Apply signature to active field ─── */
  async function handleApplyFieldSignature() {
    if (!activeFieldId) return;
    setSignError(null);
    const sigImage = await getSignatureImage();
    if (!sigImage) return;
    const dataUrl = signMode === 'draw'
      ? sigPadRef.current!.toDataURL('image/png')
      : await (async () => {
          const c = document.createElement('canvas');
          c.width = 400; c.height = 80;
          const cx = c.getContext('2d')!;
          cx.fillStyle = '#fff';
          cx.fillRect(0, 0, 400, 80);
          cx.font = 'italic 36px "Times New Roman", serif';
          cx.fillStyle = '#1a1a2e';
          cx.fillText(typedName.trim(), 20, 52);
          return c.toDataURL('image/png');
        })();
    setFieldCompletions((prev) => ({
      ...prev,
      [activeFieldId]: {
        ...prev[activeFieldId],
        value: dataUrl,
        completedAt: new Date(),
      },
    }));
    setShowSignModal(false);
    setActiveFieldId(null);
    sigPadRef.current?.clear();
    autoAdvance();
  }

  /* ─── Submit all structured fields (final signing) ─── */
  async function handleStructuredSign() {
    if (!consent) { setSignError('You must agree to the e-sign consent.'); return; }
    if (!allFieldsDone) { setSignError('Please complete all required fields before signing.'); return; }
    setSignError(null);
    setSigning(true);

    try {
      if (!genLease || !user) throw new Error('Missing lease data.');
      const origBytes = originalPdfBytesRef.current;
      if (!origBytes) throw new Error('Original PDF not loaded. Please reload the page.');

      const signingFieldIds = new Set(tenantFields.map((f) => f.fieldId));
      const completedFields: LeaseSignatureFieldValue[] = Object.values(fieldCompletions).filter(
        (f) => signingFieldIds.has(f.fieldId) && f.value
      );

      const signedPdfBytes = await applySignaturesToPdf(origBytes, completedFields, userProfile?.displayName || 'Tenant');

      const signedPath = `generated-leases/${genLease.leaseId}/signed_${Date.now()}.pdf`;
      await uploadFile(signedPath, new File([signedPdfBytes.buffer as ArrayBuffer], 'signed_lease.pdf', { type: 'application/pdf' }));

      const sigHash = await sha256Hex(signedPdfBytes);

      const updatedFields = (genLease.signatureFields ?? []).map((f) => {
        const completed = fieldCompletions[f.fieldId];
        if (completed?.value && signingFieldIds.has(f.fieldId)) {
          return { ...f, value: completed.value, completedAt: completed.completedAt };
        }
        return f;
      });

      await generatedLeaseService.update(genLease.id, {
        signingStatus: 'signed',
        signedAt: new Date(),
        pdfSignedPath: signedPath,
        signatureFields: updatedFields,
      });

      if (lease) {
        await portalDocumentService.update(lease.id, {
          status: 'signed',
          signedFilePath: signedPath,
          signatureHash: sigHash,
        });
        await portalDocumentService.addEvent(lease.id, {
          type: 'signed',
          actorUid: user.uid,
          timestamp: new Date(),
          metadata: { method: 'structured', hash: sigHash } as Record<string, string>,
        });
      }

      setSignSuccess(true);

      createAdminAlert({
        type: 'general',
        title: 'Lease Signed',
        message: `Tenant ${userProfile?.displayName || user.uid} signed lease ${genLease.leaseId.slice(0, 8)}…`,
        relatedId: genLease.id,
        relatedType: 'lease',
      });

      const blob = new Blob([signedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Signed_Lease_Agreement.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Structured signing error:', err);
      setSignError(err instanceof Error ? err.message : 'Signing failed. Please try again.');
    } finally {
      setSigning(false);
    }
  }

  /* ─── Legacy sign (non-structured) ─── */
  async function handleLegacySign() {
    if (!consent) { setSignError('You must agree to the e-sign consent.'); return; }
    setSignError(null);
    setSigning(true);

    try {
      const sigImage = await getSignatureImage();
      if (!sigImage) { setSigning(false); return; }
      const sigHash = await sha256Hex(sigImage);

      const origBytes = originalPdfBytesRef.current;
      if (!origBytes) throw new Error('Original lease file is missing.');

      const pdfDoc = await PDFDocument.load(origBytes);
      const pngImage = await pdfDoc.embedPng(sigImage);
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width: pgW } = lastPage.getSize();

      const sigW = 200;
      const sigH = (pngImage.height / pngImage.width) * sigW;
      lastPage.drawImage(pngImage, { x: pgW - sigW - 60, y: 60, width: sigW, height: sigH });

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const ts = new Date().toISOString();
      lastPage.drawText(`E-signed by ${userProfile?.displayName || 'Tenant'} on ${ts}`, { x: 40, y: 40, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
      lastPage.drawText(`SHA-256: ${sigHash.slice(0, 32)}…`, { x: 40, y: 28, size: 7, font, color: rgb(0.6, 0.6, 0.6) });

      const signedPdfBytes = await pdfDoc.save();

      if (isFirebaseConfigured && user && lease) {
        const signedPath = `documents/${user.uid}/lease/signed_${Date.now()}.pdf`;
        await uploadFile(signedPath, new File([signedPdfBytes as BlobPart], 'signed_lease.pdf', { type: 'application/pdf' }));
        await portalDocumentService.update(lease.id, { status: 'signed', signedFilePath: signedPath, signatureHash: sigHash });
        await portalDocumentService.addEvent(lease.id, { type: 'signed', actorUid: user.uid, timestamp: new Date(), metadata: { method: signMode, hash: sigHash } as Record<string, string> });
      }

      setSignSuccess(true);
      setShowSignModal(false);

      const blob = new Blob([signedPdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Signed_Lease_Agreement.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Signing error:', err);
      setSignError(err instanceof Error ? err.message : 'Signing failed. Please try again.');
    } finally {
      setSigning(false);
    }
  }

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="page"><div className="loading-container"><Loader2 size={32} className="spinner" /><p>Loading lease…</p></div></div>
    );
  }

  return (
    <div className="tenant-lease-page">
      <div className="page-header">
        <div>
          <h1><FileText size={24} /> My Lease</h1>
          <p>View your lease agreement and sign electronically</p>
        </div>
      </div>

      {pageError && (
        <div className="alert alert-error">
          <AlertCircle size={16} /> {pageError}
          <button onClick={() => setPageError(null)}>&times;</button>
        </div>
      )}

      {signSuccess && (
        <div className="alert alert-success">
          <CheckCircle size={16} /> Lease signed successfully! A signed copy has been downloaded.
          <button onClick={() => setSignSuccess(false)}>&times;</button>
        </div>
      )}

      {!lease && !genLease ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>No Lease on File</h3>
          <p>Your property manager hasn't uploaded a lease yet.</p>
        </div>
      ) : (
        <>
          {/* ─── DocuSign-style progress bar ─── */}
          {isStructured && !signSuccess && (genLease?.signingStatus === 'viewed' || genLease?.signingStatus === 'sent') && (
            <div className="ds-progress-bar">
              <div className="ds-progress-info">
                <Pen size={16} />
                <span><strong>{completedCount}</strong> of <strong>{requiredTenantFields.length}</strong> required fields completed</span>
              </div>
              <div className="ds-progress-track">
                <div
                  className="ds-progress-fill"
                  style={{ width: requiredTenantFields.length ? `${(completedCount / requiredTenantFields.length) * 100}%` : '0%' }}
                />
              </div>
              {allFieldsDone && (
                <span className="ds-progress-ready"><CheckCircle size={14} /> Ready to submit</span>
              )}
            </div>
          )}

          <div className={`ds-layout ${isStructured && !signSuccess && (genLease?.signingStatus === 'viewed' || genLease?.signingStatus === 'sent') ? 'ds-layout-split' : ''}`}>
            {/* ─── PDF Preview Panel ─── */}
            <div className="ds-pdf-panel">
              <div className="lease-card">
                <div className="lease-card-header">
                  <div className="lease-file-info">
                    <FileText size={24} className="icon-pdf" />
                    <div>
                      <h3>{lease?.fileName || 'Generated Lease'}</h3>
                      <span className="lease-meta">
                        {genLease ? `Generated lease v${genLease.templateVersion}` : `Uploaded ${fmtDate(lease!.createdAt)}`}
                      </span>
                    </div>
                  </div>
                  <div className="lease-status">
                    {(lease?.status === 'signed' || genLease?.signingStatus === 'signed' || signSuccess) ? (
                      <span className="badge badge-success"><CheckCircle size={14} /> Signed</span>
                    ) : genLease?.signingStatus === 'viewed' || genLease?.signingStatus === 'sent' ? (
                      <span className="badge badge-warning"><AlertCircle size={14} /> Awaiting Signature</span>
                    ) : lease?.status === 'pending_signature' ? (
                      <span className="badge badge-warning"><AlertCircle size={14} /> Awaiting Signature</span>
                    ) : (
                      <span className="badge badge-info">{lease?.status || genLease?.signingStatus}</span>
                    )}
                  </div>
                </div>

                {(previewPdfUrl || pdfUrl) && (
                  <div className="pdf-preview">
                    <iframe src={previewPdfUrl || pdfUrl!} title="Lease Preview" />
                  </div>
                )}

                <div className="lease-card-actions">
                  {pdfUrl && (
                    <a href={previewPdfUrl || pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                      <Download size={16} /> Download Original
                    </a>
                  )}
                  {!isStructured && (lease?.status === 'pending_signature' && !signSuccess) && (
                    <button className="btn btn-primary" onClick={() => setShowSignModal(true)}>
                      <Pen size={16} /> Sign Lease
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ─── DocuSign-style signing sidebar ─── */}
            {isStructured && !signSuccess && (genLease?.signingStatus === 'viewed' || genLease?.signingStatus === 'sent') && (
              <div className="ds-signing-panel">
                <div className="ds-panel-header">
                  <h3><Pen size={18} /> Sign Your Lease</h3>
                  <p>Complete each field below. Click a field to sign, initial, or date it.</p>
                </div>

                {/* Field list */}
                <div className="ds-field-list">
                  {tenantFields.map((f, i) => {
                    const comp = fieldCompletions[f.fieldId];
                    const isDone = !!comp?.value;
                    const isCurrent = i === currentFieldIndex;
                    return (
                      <div
                        key={f.fieldId}
                        className={`ds-field-item ${isDone ? 'ds-field-done' : 'ds-field-pending'} ${isCurrent ? 'ds-field-active' : ''}`}
                        onClick={() => {
                          setCurrentFieldIndex(i);
                          if (!isDone) handleFieldClick(f.fieldId);
                        }}
                      >
                        <div className="ds-field-icon">
                          {isDone ? (
                            <Check size={18} />
                          ) : f.type === 'signature' ? (
                            <Pen size={18} />
                          ) : f.type === 'date' ? (
                            <Calendar size={18} />
                          ) : (
                            <Type size={18} />
                          )}
                        </div>
                        <div className="ds-field-info">
                          <span className="ds-field-label">{f.displayLabel || f.fieldId}</span>
                          <span className="ds-field-hint">
                            {isDone
                              ? f.type === 'signature' ? '✓ Signed' : `✓ ${comp?.value}`
                              : f.type === 'signature' ? 'Tap to sign'
                              : f.type === 'date' ? 'Tap to apply date'
                              : 'Tap to initial'}
                          </span>
                        </div>
                        {isDone && (
                          <button
                            className="ds-field-redo"
                            title="Redo this field"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFieldCompletions((prev) => {
                                const copy = { ...prev };
                                copy[f.fieldId] = { ...copy[f.fieldId], value: undefined as any, completedAt: undefined as any };
                                return copy;
                              });
                            }}
                          >
                            ↺
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Prev / Next navigation */}
                <div className="ds-nav-buttons">
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={prevIncompleteIndex < 0}
                    onClick={() => { if (prevIncompleteIndex >= 0) setCurrentFieldIndex(prevIncompleteIndex); }}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={nextIncompleteIndex < 0}
                    onClick={() => {
                      if (nextIncompleteIndex >= 0) {
                        setCurrentFieldIndex(nextIncompleteIndex);
                        handleFieldClick(tenantFields[nextIncompleteIndex].fieldId);
                      }
                    }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>

                {signError && (
                  <div className="alert alert-error" style={{ margin: '0.75rem 0 0' }}>
                    <AlertCircle size={14} /> {signError}
                  </div>
                )}

                {/* Consent + final submit */}
                <div className="ds-submit-section">
                  <label className="consent-label">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <Shield size={14} />
                    <span>I agree to use an electronic signature with the same legal effect as a handwritten signature.</span>
                  </label>
                  <button
                    className="btn btn-primary ds-submit-btn"
                    disabled={signing || !consent || !allFieldsDone}
                    onClick={handleStructuredSign}
                  >
                    {signing ? <><Loader2 size={16} className="spinner" /> Signing…</> : <><CheckCircle size={16} /> Submit Signed Lease</>}
                  </button>
                  {!allFieldsDone && consent && (
                    <p className="ds-submit-hint">{requiredTenantFields.length - completedCount} field(s) remaining</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Signing Modal ─── */}
      {showSignModal && (
        <div className="modal-overlay" onClick={() => { setShowSignModal(false); setActiveFieldId(null); }}>
          <div className="sign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Pen size={18} /> {activeFieldId ? 'Capture Signature' : 'Electronic Signature'}</h3>
              <button className="modal-close" onClick={() => { setShowSignModal(false); setActiveFieldId(null); }}><X size={18} /></button>
            </div>

            <div className="modal-body">
              {signError && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={14} /> {signError}
                </div>
              )}

              <div className="sign-tabs">
                <button className={signMode === 'draw' ? 'active' : ''} onClick={() => setSignMode('draw')}>
                  <Pen size={16} /> Draw
                </button>
                <button className={signMode === 'type' ? 'active' : ''} onClick={() => setSignMode('type')}>
                  <FileText size={16} /> Type
                </button>
              </div>

              {signMode === 'draw' ? (
                <div className="sig-canvas-wrap">
                  <canvas ref={canvasRef} className="sig-canvas" />
                  <button className="clear-btn" onClick={() => sigPadRef.current?.clear()}>Clear</button>
                </div>
              ) : (
                <div className="sig-type">
                  <input type="text" placeholder="Type your full legal name" value={typedName} onChange={(e) => setTypedName(e.target.value)} />
                  {typedName && <div className="sig-preview">{typedName}</div>}
                </div>
              )}

              {!activeFieldId && (
                <label className="consent-label">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <Shield size={14} />
                  <span>I agree to use an electronic signature. I understand this has the same legal effect as a handwritten signature.</span>
                </label>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => { setShowSignModal(false); setActiveFieldId(null); }}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={signing || (!activeFieldId && !consent)}
                onClick={activeFieldId ? handleApplyFieldSignature : handleLegacySign}
              >
                {signing
                  ? <><Loader2 size={16} className="spinner" /> Signing…</>
                  : activeFieldId ? <>Apply Signature</> : <>Sign &amp; Download</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
