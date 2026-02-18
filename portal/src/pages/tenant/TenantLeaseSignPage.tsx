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
} from 'lucide-react';
import SignaturePad from 'signature_pad';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { useAuth } from '../../contexts';
import { portalDocumentService, isFirebaseConfigured } from '../../lib/firebase';
import { uploadFile, getFileUrl } from '../../lib/firebase/storage';
import type { PortalDocument, PortalDocStatus } from '../../types';
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

/* ─── Demo Data ─── */
const DEMO_LEASE: PortalDocument = {
  id: 'demo-lease-1',
  ownerUid: 'demo-tenant-001',
  uploadedByUid: 'admin-001',
  roleScope: 'tenant',
  category: 'lease',
  fileName: 'Lease_Agreement_2026.pdf',
  originalFilePath: '',
  status: 'pending_signature' as PortalDocStatus,
  requiresSignature: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
} as PortalDocument;

/* ─── Component ─── */
export function TenantLeaseSignPage() {
  const { user, userProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);

  const [lease, setLease] = useState<PortalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Signing state
  const [showSignModal, setShowSignModal] = useState(false);
  const [signMode, setSignMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [consent, setConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signSuccess, setSignSuccess] = useState(false);

  /* ─── Load lease document ─── */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (!isFirebaseConfigured || !user) {
          setLease(DEMO_LEASE);
          return;
        }
        const docs = await portalDocumentService.getByOwner(user.uid);
        const found = docs.find(
          (d) => d.category === 'lease' && d.requiresSignature
        );
        if (found) {
          setLease(found);
          if (found.originalFilePath) {
            const url = await getFileUrl(found.originalFilePath);
            setPdfUrl(url);
          }
        }
      } catch (err) {
        console.error('Error loading lease:', err);
        setLease(DEMO_LEASE);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  /* ─── Init signature pad when modal opens ─── */
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
      // Small delay for DOM
      const t = setTimeout(initSigPad, 100);
      return () => clearTimeout(t);
    }
    return () => {
      sigPadRef.current = null;
    };
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
      // Render typed name to a canvas image
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

  /* ─── Sign and stamp PDF ─── */
  async function handleSign() {
    if (!consent) {
      setSignError('You must agree to the e-sign consent.');
      return;
    }
    setSignError(null);
    setSigning(true);

    try {
      const sigImage = await getSignatureImage();
      if (!sigImage) { setSigning(false); return; }

      // Compute signature hash
      const sigHash = await sha256Hex(sigImage);

      let signedPdfBytes: Uint8Array;
      if (pdfUrl) {
        // Fetch the original PDF and stamp it
        const pdfBytes = await fetch(pdfUrl).then(r => r.arrayBuffer());
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pngImage = await pdfDoc.embedPng(sigImage);
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        const { width: pgW } = lastPage.getSize();

        // Stamp signature at bottom of last page
        const sigW = 200;
        const sigH = (pngImage.height / pngImage.width) * sigW;
        lastPage.drawImage(pngImage, {
          x: pgW - sigW - 60,
          y: 60,
          width: sigW,
          height: sigH,
        });

        // Add timestamp text
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const ts = new Date().toISOString();
        lastPage.drawText(
          `E-signed by ${userProfile?.displayName || 'Tenant'} on ${ts}`,
          { x: 40, y: 40, size: 8, font, color: rgb(0.4, 0.4, 0.4) }
        );
        lastPage.drawText(
          `SHA-256: ${sigHash.slice(0, 32)}…`,
          { x: 40, y: 28, size: 7, font, color: rgb(0.6, 0.6, 0.6) }
        );

        signedPdfBytes = await pdfDoc.save();
      } else {
        // Demo mode – create a simple signed PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([612, 792]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.drawText('LEASE AGREEMENT – SIGNED COPY', { x: 50, y: 740, size: 18, font });
        page.drawText(`Tenant: ${userProfile?.displayName || 'Demo Tenant'}`, { x: 50, y: 700, size: 12, font });
        page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y: 680, size: 12, font });
        const pngImage = await pdfDoc.embedPng(sigImage);
        const sigW = 200;
        const sigH = (pngImage.height / pngImage.width) * sigW;
        page.drawImage(pngImage, { x: 50, y: 560, width: sigW, height: sigH });
        page.drawText(`SHA-256: ${sigHash}`, { x: 50, y: 540, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
        signedPdfBytes = await pdfDoc.save();
      }

      // Upload signed PDF
      if (isFirebaseConfigured && user && lease) {
        const signedPath = `documents/${user.uid}/lease/signed_${Date.now()}.pdf`;
        await uploadFile(signedPath, new File([signedPdfBytes.buffer as ArrayBuffer], 'signed_lease.pdf', { type: 'application/pdf' }));

        // Update document record
        await portalDocumentService.update(lease.id, {
          status: 'signed',
          signedFilePath: signedPath,
          signatureHash: sigHash,
        });

        // Add event
        await portalDocumentService.addEvent(lease.id, {
          type: 'signed',
          actorUid: user.uid,
          timestamp: new Date(),
          metadata: { method: signMode, hash: sigHash } as Record<string, string>,
        });
      }

      setSignSuccess(true);
      setShowSignModal(false);

      // Download signed copy for user
      const blob = new Blob([signedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Signed_Lease_Agreement.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Signing error:', err);
      setSignError('Signing failed. Please try again.');
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

      {signSuccess && (
        <div className="alert alert-success">
          <CheckCircle size={16} /> Lease signed successfully! A signed copy has been downloaded.
          <button onClick={() => setSignSuccess(false)}>&times;</button>
        </div>
      )}

      {!lease ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>No Lease on File</h3>
          <p>Your property manager hasn't uploaded a lease yet.</p>
        </div>
      ) : (
        <div className="lease-card">
          <div className="lease-card-header">
            <div className="lease-file-info">
              <FileText size={24} className="icon-pdf" />
              <div>
                <h3>{lease.fileName}</h3>
                <span className="lease-meta">Uploaded {fmtDate(lease.createdAt)}</span>
              </div>
            </div>
            <div className="lease-status">
              {lease.status === 'signed' || signSuccess ? (
                <span className="badge badge-success"><CheckCircle size={14} /> Signed</span>
              ) : lease.status === 'pending_signature' ? (
                <span className="badge badge-warning"><AlertCircle size={14} /> Awaiting Signature</span>
              ) : (
                <span className="badge badge-info">{lease.status}</span>
              )}
            </div>
          </div>

          {/* PDF preview */}
          {pdfUrl && (
            <div className="pdf-preview">
              <iframe src={pdfUrl} title="Lease Preview" />
            </div>
          )}

          <div className="lease-card-actions">
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                <Download size={16} /> Download Original
              </a>
            )}
            {(lease.status === 'pending_signature' && !signSuccess) && (
              <button className="btn btn-primary" onClick={() => setShowSignModal(true)}>
                <Pen size={16} /> Sign Lease
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Signing Modal ─── */}
      {showSignModal && (
        <div className="modal-overlay" onClick={() => setShowSignModal(false)}>
          <div className="sign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Pen size={18} /> Electronic Signature</h3>
              <button className="modal-close" onClick={() => setShowSignModal(false)}><X size={18} /></button>
            </div>

            <div className="modal-body">
              {signError && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={14} /> {signError}
                </div>
              )}

              {/* Mode tabs */}
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
                  <input
                    type="text"
                    placeholder="Type your full legal name"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                  />
                  {typedName && (
                    <div className="sig-preview">{typedName}</div>
                  )}
                </div>
              )}

              {/* Consent */}
              <label className="consent-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <Shield size={14} />
                <span>
                  I agree to use an electronic signature. I understand this has the same legal effect as a handwritten signature.
                </span>
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowSignModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={signing || !consent}
                onClick={handleSign}
              >
                {signing ? <><Loader2 size={16} className="spinner" /> Signing…</> : <>Sign &amp; Download</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
