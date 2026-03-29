import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Home, FileText, DollarSign, Wrench, Bell, Clock,
  ChevronDown, Send, Upload, Plus, Minus, Edit, UserPlus, UserMinus,
  Calendar, Mail, Phone, CheckCircle, XCircle, Download,
  RefreshCw, X, AlertTriangle, CreditCard, Users,
} from 'lucide-react';
import { useAuth } from '../../contexts';
import {
  userService, leaseService, propertyService, maintenanceService,
  alertService, activityLogService, inspectionService,
  generatedLeaseService,
} from '../../lib/firebase/firestore';
import { rentStatementService, ledgerService, portalDocumentService } from '../../lib/firebase/rentStatements';
import { paymentService } from '../../lib/firebase/firestore';
import { uploadLeaseDocument, getFileUrl } from '../../lib/firebase/storage';
import { assignLease, editLease, addStatementEntry } from '../../lib/api/portalApi';
import { createAdminAlert } from '../../lib/firebase/adminAlerts';
import type {
  UserProfile, Property, Lease, RentStatement, LedgerEntry, Payment,
  MaintenanceTicket, Alert, PortalDocument, ActivityLog, LeaseOccupant,
  MoveInInspection, GeneratedLease,
} from '../../types';
import './TenantProfile.css';

type Tab = 'lease' | 'statements' | 'payments' | 'documents' | 'maintenance' | 'inspection' | 'notices' | 'activity';

const TAB_LABELS: Record<Tab, { label: string; icon: React.ReactNode }> = {
  lease: { label: 'Lease & Property', icon: <Home size={16} /> },
  statements: { label: 'Statements', icon: <DollarSign size={16} /> },
  payments: { label: 'Payments', icon: <CreditCard size={16} /> },
  documents: { label: 'Documents', icon: <FileText size={16} /> },
  maintenance: { label: 'Maintenance', icon: <Wrench size={16} /> },
  inspection: { label: 'Inspection', icon: <CheckCircle size={16} /> },
  notices: { label: 'Notices', icon: <Bell size={16} /> },
  activity: { label: 'Activity', icon: <Clock size={16} /> },
};

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export function TenantProfilePage() {
  const { id: tenantUid } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: adminUser } = useAuth();

  // ── Core data ──
  const [tenant, setTenant] = useState<UserProfile | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [statements, setStatements] = useState<RentStatement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [notices, setNotices] = useState<Alert[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [inspections, setInspections] = useState<MoveInInspection[]>([]);
  const [allLeases, setAllLeases] = useState<Lease[]>([]);
  const [generatedLeases, setGeneratedLeases] = useState<GeneratedLease[]>([]);

  // ── Ledger for selected statement ──
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // ── UI ──
  const [activeTab, setActiveTab] = useState<Tab>('lease');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);

  // ── Modals ──
  const [modal, setModal] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // ── Assign lease form ──
  const [assignForm, setAssignForm] = useState({ propertyId: '', startDate: '', rentDollars: '', depositDollars: '' });

  // ── Edit lease form ──
  const [editLeaseForm, setEditLeaseForm] = useState({ rentDollars: '', depositDollars: '', endDate: '', gracePeriodDays: '', status: '' });

  // ── Fee/Credit/Adjustment form ──
  const [entryForm, setEntryForm] = useState({ type: 'fee' as 'fee' | 'credit' | 'adjustment', label: '', amountDollars: '', notes: '', statementId: '' });

  // ── Notice form ──
  const [noticeForm, setNoticeForm] = useState({ title: '', message: '' });

  // ── Edit contact form ──
  const [contactForm, setContactForm] = useState({ phone: '', preferredContactMethod: '' as string, emergencyName: '', emergencyPhone: '', emergencyRelationship: '' });

  // ── Upload lease doc ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // ── Occupants form ──
  const [occupantForm, setOccupantForm] = useState<LeaseOccupant>({ fullName: '', email: '', phone: '', type: 'secondary', notes: '' });

  // ── Renew lease form ──
  const [renewEndDate, setRenewEndDate] = useState('');

  /* ================================================================
     DATA LOADING
     ================================================================ */
  const loadAll = useCallback(async () => {
    if (!tenantUid) return;
    try {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        userService.get(tenantUid),
        leaseService.getByTenant(tenantUid),
        propertyService.getAll(),
        rentStatementService.getByTenantUid(tenantUid),
        paymentService.getByTenantUid(tenantUid),
        portalDocumentService.getByOwner(tenantUid),
        maintenanceService.getByTenant(tenantUid),
        alertService.getByUser(tenantUid),
        generatedLeaseService.getByTenant(tenantUid),
        activityLogService.getByTargetUid(tenantUid),
        inspectionService.getByTenant(tenantUid),
      ]);

      const tenantData = results[0].status === 'fulfilled' ? results[0].value : null;
      if (!tenantData) { setError('Tenant not found'); setLoading(false); return; }
      setTenant(tenantData);

      const tenantLeases = results[1].status === 'fulfilled' ? results[1].value : [];
      setAllLeases(tenantLeases);
      const activeLease = tenantLeases.find(l => l.status === 'active') || tenantLeases[0] || null;
      setLease(activeLease);

      const allProps = results[2].status === 'fulfilled' ? results[2].value : [];
      setProperties(allProps);
      if (activeLease?.propertyId) {
        setProperty(allProps.find(p => p.id === activeLease.propertyId) || null);
      } else {
        setProperty(null);
      }

      setStatements(results[3].status === 'fulfilled' ? results[3].value : []);
      setPayments(results[4].status === 'fulfilled' ? results[4].value : []);
      setDocuments(results[5].status === 'fulfilled' ? results[5].value : []);
      setTickets(results[6].status === 'fulfilled' ? results[6].value : []);
      setNotices(results[7].status === 'fulfilled' ? results[7].value : []);
      setGeneratedLeases(results[8].status === 'fulfilled' ? (results[8].value as GeneratedLease[]) : []);
      setActivity(results[9].status === 'fulfilled' ? results[9].value : []);
      setInspections(results[10].status === 'fulfilled' ? results[10].value : []);
    } catch (err) {
      console.error('Failed to load tenant data:', err);
      setError('Failed to load tenant data.');
    } finally {
      setLoading(false);
    }
  }, [tenantUid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Load ledger when statement selected
  useEffect(() => {
    if (!selectedStatementId) { setLedgerEntries([]); return; }
    setLedgerLoading(true);
    ledgerService.getByStatement(selectedStatementId)
      .then(setLedgerEntries)
      .catch(() => setLedgerEntries([]))
      .finally(() => setLedgerLoading(false));
  }, [selectedStatementId]);

  /* ================================================================
     HELPERS
     ================================================================ */
  const fmt = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  const fmtDollars = (d: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(d);
  const fmtDate = (d: Date | string | null | undefined) => {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const openBalance = statements.filter(s => s.status === 'open').reduce((sum, s) => sum + s.balanceCents, 0);

  const closeModal = () => { setModal(null); setModalError(null); setModalLoading(false); };

  const logActivity = async (action: string, targetType: string, targetId: string, metadata?: Record<string, unknown>) => {
    if (!adminUser || !tenantUid) return;
    try {
      await activityLogService.create({
        actorUid: adminUser.uid,
        targetUid: tenantUid,
        action: action as ActivityLog['action'],
        targetType: targetType as ActivityLog['targetType'],
        targetId,
        metadata,
      });
    } catch { /* non-blocking */ }
  };

  /* ================================================================
     ACTIONS
     ================================================================ */

  // Assign Lease
  const handleAssignLease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantUid || !assignForm.propertyId) return;
    setModalError(null); setModalLoading(true);
    try {
      const rentCents = Math.round(Number(assignForm.rentDollars) * 100);
      const depositCents = Math.round(Number(assignForm.depositDollars || 0) * 100);
      if (!rentCents || rentCents <= 0) throw new Error('Valid rent amount required');
      await assignLease({
        tenantUid,
        propertyId: assignForm.propertyId,
        startDate: assignForm.startDate,
        rentAmountCents: rentCents,
        depositAmountCents: depositCents,
        endCurrentLease: true,
      });
      closeModal();
      await loadAll();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to assign lease');
    } finally {
      setModalLoading(false);
    }
  };

  // Edit Lease
  const handleEditLease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lease) return;
    setModalError(null); setModalLoading(true);
    try {
      const updates: Record<string, unknown> = {};
      if (editLeaseForm.rentDollars) updates.rentAmountCents = Math.round(Number(editLeaseForm.rentDollars) * 100);
      if (editLeaseForm.depositDollars) updates.depositAmountCents = Math.round(Number(editLeaseForm.depositDollars) * 100);
      if (editLeaseForm.endDate) updates.endDate = editLeaseForm.endDate;
      if (editLeaseForm.gracePeriodDays) updates.gracePeriodDays = Number(editLeaseForm.gracePeriodDays);
      if (editLeaseForm.status) updates.status = editLeaseForm.status;
      if (Object.keys(updates).length === 0) throw new Error('No changes specified');
      await editLease(lease.id, updates);
      closeModal();
      await loadAll();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to edit lease');
    } finally {
      setModalLoading(false);
    }
  };

  // End Lease
  const handleEndLease = async () => {
    if (!lease || !confirm('End this lease? This will set status to "ended".')) return;
    try {
      await editLease(lease.id, { status: 'ended' });
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to end lease');
    }
  };

  // Renew Lease
  const handleRenewLease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lease || !renewEndDate) return;
    setModalError(null); setModalLoading(true);
    try {
      await editLease(lease.id, { endDate: new Date(renewEndDate), status: 'active' });
      await logActivity('lease_renewed', 'lease', lease.id, { newEndDate: renewEndDate });
      closeModal();
      await loadAll();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to renew lease');
    } finally {
      setModalLoading(false);
    }
  };

  // Add Fee/Credit/Adjustment
  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const stmtId = entryForm.statementId || selectedStatementId || (statements.length > 0 ? statements[0].id : '');
    if (!stmtId) { setModalError('No statement selected'); return; }
    setModalError(null); setModalLoading(true);
    try {
      const amountCents = Math.round(Number(entryForm.amountDollars) * 100);
      if (!amountCents || amountCents <= 0) throw new Error('Valid amount required');
      if (entryForm.type === 'adjustment' && !entryForm.notes.trim()) throw new Error('Note is required for adjustments');
      await addStatementEntry(stmtId, {
        type: entryForm.type,
        label: entryForm.label,
        amountCents,
        notes: entryForm.notes,
      });
      closeModal();
      // Refresh statements + ledger
      const freshStatements = await rentStatementService.getByTenantUid(tenantUid!);
      setStatements(freshStatements);
      if (selectedStatementId) {
        const freshLedger = await ledgerService.getByStatement(selectedStatementId);
        setLedgerEntries(freshLedger);
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setModalLoading(false);
    }
  };

  // Send Notice
  const handleSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantUid) return;
    setModalError(null); setModalLoading(true);
    try {
      await alertService.create({
        userId: tenantUid,
        type: 'general',
        title: noticeForm.title,
        message: noticeForm.message,
        read: false,
        archived: false,
      });
      await logActivity('notice_sent', 'user', tenantUid, { title: noticeForm.title });
      createAdminAlert({
        type: 'general',
        title: 'Notice Sent',
        message: `Notice "${noticeForm.title}" sent to ${tenant?.displayName || 'tenant'}.`,
      });
      closeModal();
      // Refresh notices
      const freshNotices = await alertService.getByUser(tenantUid);
      setNotices(freshNotices);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to send notice');
    } finally {
      setModalLoading(false);
    }
  };

  // Edit Contact
  const handleEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantUid) return;
    setModalError(null); setModalLoading(true);
    try {
      const updates: Partial<UserProfile> = {};
      if (contactForm.phone) updates.phone = contactForm.phone;
      if (contactForm.preferredContactMethod) updates.preferredContactMethod = contactForm.preferredContactMethod as UserProfile['preferredContactMethod'];
      if (contactForm.emergencyName) {
        updates.emergencyContact = {
          name: contactForm.emergencyName,
          phone: contactForm.emergencyPhone,
          relationship: contactForm.emergencyRelationship,
        };
      }
      await userService.update(tenantUid, updates);
      await logActivity('contact_updated', 'user', tenantUid);
      closeModal();
      const freshTenant = await userService.get(tenantUid);
      if (freshTenant) setTenant(freshTenant);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to update contact');
    } finally {
      setModalLoading(false);
    }
  };

  // Upload Lease Document
  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !tenantUid || !adminUser) return;
    setModalError(null); setModalLoading(true);
    try {
      const filePath = await uploadLeaseDocument(tenantUid, uploadFile);

      // Void any existing active lease docs before creating the new one
      const existingDocs = await portalDocumentService.getByOwner(tenantUid);
      const activeLeaseDocs = existingDocs.filter(
        (d) => d.category === 'lease' && d.status !== 'void' && d.status !== 'signed'
      );
      for (const old of activeLeaseDocs) {
        await portalDocumentService.update(old.id, { status: 'void' as const });
      }

      await portalDocumentService.create({
        ownerUid: tenantUid,
        uploadedByUid: adminUser.uid,
        category: 'lease',
        fileName: uploadFile.name,
        originalFilePath: filePath,
        status: 'sent',
        requiresSignature: true,
        roleScope: 'tenant',
      });
      await logActivity('lease_doc_uploaded', 'document', tenantUid, { fileName: uploadFile.name });
      closeModal();
      setUploadFile(null);
      const freshDocs = await portalDocumentService.getByOwner(tenantUid);
      setDocuments(freshDocs);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setModalLoading(false);
    }
  };

  // Void a portal document
  const handleVoidDoc = async (docId: string) => {
    if (!confirm('Void this document? The tenant will no longer see it as active.')) return;
    try {
      await portalDocumentService.update(docId, { status: 'void' as const });
      // Also void any linked GeneratedLease
      const linked = generatedLeases.find(g => g.portalDocumentId === docId);
      if (linked) {
        await generatedLeaseService.update(linked.id, { signingStatus: 'voided' });
      }
      createAdminAlert({
        type: 'general',
        title: 'Document Voided',
        message: `A document was voided for ${tenant?.displayName || 'tenant'}.`,
        relatedId: docId,
        relatedType: 'lease',
      });
      await loadAll();
    } catch (err) {
      console.error('Error voiding document:', err);
      alert('Failed to void document.');
    }
  };

  // Void & Reset – voids ALL active generated leases + portal docs so a new one can be sent
  const handleVoidAndResetLease = async () => {
    if (!tenantUid) return;
    const msg = 'Void the current lease document and reset signing? This lets you generate and send a new one.';
    if (!confirm(msg)) return;
    try {
      // Void all non-voided GeneratedLeases for this tenant
      for (const gl of generatedLeases) {
        if (gl.signingStatus !== 'voided') {
          await generatedLeaseService.update(gl.id, { signingStatus: 'voided' });
        }
      }
      // Void all active lease portal docs
      const leaseDocs = documents.filter(d => d.category === 'lease' && d.status !== 'void');
      for (const doc of leaseDocs) {
        await portalDocumentService.update(doc.id, { status: 'void' as const });
      }
      await logActivity('lease_voided', 'lease', lease?.id || tenantUid, { reason: 'Admin voided and reset' });
      await loadAll();
      alert('Lease documents voided. You can now generate and send a new lease.');
    } catch (err) {
      console.error('Error voiding lease:', err);
      alert('Failed to void lease documents.');
    }
  };

  // Manage Occupants - Add
  const handleAddOccupant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lease || !occupantForm.fullName.trim()) return;
    setModalError(null); setModalLoading(true);
    try {
      const current = lease.occupants || [];
      const updated = [...current, { ...occupantForm }];
      await editLease(lease.id, { occupants: updated } as Record<string, unknown>);
      await logActivity('occupant_added', 'lease', lease.id, { occupantName: occupantForm.fullName });
      setOccupantForm({ fullName: '', email: '', phone: '', type: 'secondary', notes: '' });
      await loadAll();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to add occupant');
    } finally {
      setModalLoading(false);
    }
  };

  const handleRemoveOccupant = async (idx: number) => {
    if (!lease) return;
    const current = lease.occupants || [];
    const removed = current[idx];
    if (!confirm(`Remove ${removed.fullName}?`)) return;
    try {
      const updated = current.filter((_, i) => i !== idx);
      await editLease(lease.id, { occupants: updated } as Record<string, unknown>);
      await logActivity('occupant_removed', 'lease', lease.id, { occupantName: removed.fullName });
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove occupant');
    }
  };

  /* ================================================================
     OPEN MODAL HELPERS
     ================================================================ */
  const openAssign = () => {
    setAssignForm({ propertyId: '', startDate: new Date().toISOString().slice(0, 10), rentDollars: '', depositDollars: '' });
    setModal('assign');
  };

  const openEditLease = () => {
    if (!lease) return;
    setEditLeaseForm({
      rentDollars: lease.monthlyRent ? String(lease.monthlyRent) : '',
      depositDollars: lease.securityDeposit ? String(lease.securityDeposit) : '',
      endDate: lease.endDate ? new Date(lease.endDate).toISOString().slice(0, 10) : '',
      gracePeriodDays: String(lease.gracePeriodDays || ''),
      status: lease.status || '',
    });
    setModal('editLease');
  };

  const openEntry = (type: 'fee' | 'credit' | 'adjustment') => {
    setEntryForm({ type, label: '', amountDollars: '', notes: '', statementId: selectedStatementId || (statements[0]?.id || '') });
    setModal('entry');
  };

  const openNotice = () => {
    setNoticeForm({ title: '', message: '' });
    setModal('notice');
  };

  const openEditContact = () => {
    setContactForm({
      phone: tenant?.phone || '',
      preferredContactMethod: tenant?.preferredContactMethod || '',
      emergencyName: tenant?.emergencyContact?.name || '',
      emergencyPhone: tenant?.emergencyContact?.phone || '',
      emergencyRelationship: tenant?.emergencyContact?.relationship || '',
    });
    setModal('editContact');
  };

  const openUploadDoc = () => {
    setUploadFile(null);
    setModal('uploadDoc');
  };

  const openOccupants = () => {
    setOccupantForm({ fullName: '', email: '', phone: '', type: 'secondary', notes: '' });
    setModal('occupants');
  };

  const openRenew = () => {
    const currentEnd = lease?.endDate ? new Date(lease.endDate) : new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setFullYear(newEnd.getFullYear() + 1);
    setRenewEndDate(newEnd.toISOString().slice(0, 10));
    setModal('renew');
  };

  // Auto-fill rent/deposit when property selected in assign modal
  const handleAssignPropertyChange = (pid: string) => {
    const prop = properties.find(p => p.id === pid);
    setAssignForm(f => ({
      ...f,
      propertyId: pid,
      rentDollars: prop?.monthlyRent ? String(prop.monthlyRent) : f.rentDollars,
      depositDollars: prop?.securityDeposit ? String(prop.securityDeposit) : f.depositDollars,
    }));
  };

  /* ================================================================
     RENDER
     ================================================================ */
  if (loading) {
    return (
      <div className="tenant-profile">
        <div className="loading-state"><div className="spinner" /><p>Loading tenant profile…</p></div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="tenant-profile">
        <div className="error-state">
          <AlertTriangle size={32} />
          <h2>{error || 'Tenant not found'}</h2>
          <button onClick={() => navigate('/admin/tenants')} className="btn btn-primary">Back to Tenants</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tenant-profile">
      {/* ── Header ── */}
      <div className="tp-header">
        <div className="tp-header-left">
          <button onClick={() => navigate('/admin/tenants')} className="btn btn-ghost btn-icon" title="Back">
            <ArrowLeft size={20} />
          </button>
          <div className="tp-avatar">{tenant.displayName?.charAt(0).toUpperCase() || '?'}</div>
          <div>
            <h1 className="tp-name">{tenant.displayName || tenant.email}</h1>
            <div className="tp-meta">
              <span><Mail size={14} /> {tenant.email}</span>
              {tenant.phone && <span><Phone size={14} /> {tenant.phone}</span>}
              <span className="badge badge-tenant">Tenant</span>
            </div>
          </div>
        </div>
        <div className="tp-header-right">
          <button onClick={loadAll} className="btn btn-outline btn-sm" title="Refresh">
            <RefreshCw size={14} /> Refresh
          </button>
          {/* Actions Dropdown */}
          <div className="dropdown-container">
            <button onClick={() => setActionsOpen(!actionsOpen)} className="btn btn-primary btn-sm">
              Actions <ChevronDown size={14} />
            </button>
            {actionsOpen && (
              <div className="dropdown-menu" onClick={() => setActionsOpen(false)}>
                <button onClick={openAssign}><Home size={14} /> {lease ? 'Change Property' : 'Assign Property'}</button>
                {lease && <button onClick={openEditLease}><Edit size={14} /> Edit Lease Terms</button>}
                {lease && <button onClick={handleEndLease}><XCircle size={14} /> End Lease</button>}
                {lease && <button onClick={openRenew}><Calendar size={14} /> Renew Lease</button>}
                <hr />
                <button onClick={() => openEntry('fee')}><Plus size={14} /> Add Fee</button>
                <button onClick={() => openEntry('credit')}><Minus size={14} /> Add Credit</button>
                <button onClick={() => openEntry('adjustment')}><DollarSign size={14} /> Add Adjustment</button>
                <hr />
                <button onClick={openNotice}><Send size={14} /> Send Notice</button>
                <button onClick={openUploadDoc}><Upload size={14} /> Upload Lease Doc</button>
                <button onClick={() => { setActiveTab('documents'); }}><FileText size={14} /> View Documents</button>
                <button onClick={() => { setActiveTab('payments'); }}><CreditCard size={14} /> View Payment History</button>
                <button onClick={() => { setActiveTab('maintenance'); }}><Wrench size={14} /> View Maintenance</button>
                <hr />
                {lease && <button onClick={() => navigate(`/admin/generate-lease?tenantId=${tenantUid}&leaseId=${lease.id}`)}><FileText size={14} /> Generate Lease</button>}
                {lease && <button onClick={handleVoidAndResetLease} style={{ color: '#dc2626' }}><AlertTriangle size={14} /> Void &amp; Reset Lease</button>}
                <hr />
                {lease && <button onClick={openOccupants}><Users size={14} /> Manage Occupants</button>}
                <button onClick={openEditContact}><User size={14} /> Edit Contact Info</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="tp-summary-cards">
        <div className="tp-card">
          <div className="tp-card-label">Property</div>
          <div className="tp-card-value">{property ? `${property.address}${property.unit ? ` #${property.unit}` : ''}` : 'Unassigned'}</div>
        </div>
        <div className="tp-card">
          <div className="tp-card-label">Lease Status</div>
          <div className="tp-card-value">
            {lease ? <span className={`badge badge-${lease.status === 'active' ? 'success' : lease.status === 'ended' ? 'gray' : 'warning'}`}>{lease.status}</span> : <span className="badge badge-gray">No Lease</span>}
          </div>
        </div>
        <div className="tp-card">
          <div className="tp-card-label">Monthly Rent</div>
          <div className="tp-card-value">{lease ? fmtDollars(lease.monthlyRent) : '—'}</div>
        </div>
        <div className={`tp-card ${openBalance > 0 ? 'tp-card-alert' : ''}`}>
          <div className="tp-card-label">Open Balance</div>
          <div className="tp-card-value">{fmt(openBalance)}</div>
        </div>
        <div className="tp-card">
          <div className="tp-card-label">Joined</div>
          <div className="tp-card-value">{fmtDate(tenant.createdAt)}</div>
        </div>
      </div>

      {/* ── Contact & Emergency ── */}
      <div className="tp-contact-row">
        <div className="tp-contact-block">
          <h3>Contact Info <button className="btn btn-ghost btn-icon btn-xs" onClick={openEditContact} title="Edit"><Edit size={14} /></button></h3>
          <div className="tp-detail"><Mail size={14} /> {tenant.email}</div>
          <div className="tp-detail"><Phone size={14} /> {tenant.phone || '—'}</div>
          <div className="tp-detail">Preferred: {tenant.preferredContactMethod || 'email'}</div>
        </div>
        <div className="tp-contact-block">
          <h3>Emergency Contact</h3>
          {tenant.emergencyContact ? (
            <>
              <div className="tp-detail">{tenant.emergencyContact.name}</div>
              <div className="tp-detail"><Phone size={14} /> {tenant.emergencyContact.phone}</div>
              <div className="tp-detail">Relationship: {tenant.emergencyContact.relationship}</div>
            </>
          ) : (
            <div className="tp-detail muted">Not provided</div>
          )}
        </div>
        {lease?.occupants && lease.occupants.length > 0 && (
          <div className="tp-contact-block">
            <h3>Occupants <button className="btn btn-ghost btn-icon btn-xs" onClick={openOccupants} title="Manage"><Edit size={14} /></button></h3>
            {lease.occupants.map((o, i) => (
              <div key={i} className="tp-detail">
                {o.fullName} <span className="badge badge-sm badge-gray">{o.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="tp-tabs">
        {(Object.entries(TAB_LABELS) as [Tab, { label: string; icon: React.ReactNode }][]).map(([key, val]) => (
          <button key={key} className={`tp-tab ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
            {val.icon} {val.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="tp-tab-content">
        {activeTab === 'lease' && <LeaseTab lease={lease} allLeases={allLeases} property={property} generatedLeases={generatedLeases} fmtDate={fmtDate} fmtDollars={fmtDollars} openAssign={openAssign} openEditLease={openEditLease} openRenew={openRenew} onEndLease={handleEndLease} openOccupants={openOccupants} onVoidAndReset={handleVoidAndResetLease} tenantUid={tenantUid || ''} navigate={navigate} />}
        {activeTab === 'statements' && <StatementsTab statements={statements} selectedStatementId={selectedStatementId} setSelectedStatementId={setSelectedStatementId} ledgerEntries={ledgerEntries} ledgerLoading={ledgerLoading} fmt={fmt} fmtDate={fmtDate} openEntry={openEntry} />}
        {activeTab === 'payments' && <PaymentsTab payments={payments} fmt={fmt} fmtDate={fmtDate} />}
        {activeTab === 'documents' && <DocumentsTab documents={documents} fmtDate={fmtDate} openUploadDoc={openUploadDoc} onVoidDoc={handleVoidDoc} />}
        {activeTab === 'maintenance' && <MaintenanceTab tickets={tickets} fmtDate={fmtDate} />}
        {activeTab === 'inspection' && <InspectionTab inspections={inspections} fmtDate={fmtDate} />}
        {activeTab === 'notices' && <NoticesTab notices={notices} fmtDate={fmtDate} openNotice={openNotice} />}
        {activeTab === 'activity' && <ActivityTab activity={activity} fmtDate={fmtDate} />}
      </div>

      {/* ================================================================
         MODALS
         ================================================================ */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {/* Assign Lease */}
            {modal === 'assign' && (
              <>
                <div className="modal-header"><h2><Home size={20} /> {lease ? 'Change' : 'Assign'} Property</h2><button className="modal-close" onClick={closeModal}><X size={20} /></button></div>
                <form onSubmit={handleAssignLease} className="modal-body">
                  {modalError && <div className="form-error"><AlertTriangle size={16} /> {modalError}</div>}
                  <label className="form-label">Property
                    <select value={assignForm.propertyId} onChange={e => handleAssignPropertyChange(e.target.value)} required>
                      <option value="">Select property</option>
                      {properties.map(p => <option key={p.id} value={p.id}>{p.address}{p.unit ? ` #${p.unit}` : ''} ({p.occupancyStatus})</option>)}
                    </select>
                  </label>
                  <label className="form-label">Start Date<input type="date" value={assignForm.startDate} onChange={e => setAssignForm(f => ({ ...f, startDate: e.target.value }))} required /></label>
                  <label className="form-label">Monthly Rent ($)<input type="number" min="1" step="0.01" value={assignForm.rentDollars} onChange={e => setAssignForm(f => ({ ...f, rentDollars: e.target.value }))} required /></label>
                  <label className="form-label">Security Deposit ($)<input type="number" min="0" step="0.01" value={assignForm.depositDollars} onChange={e => setAssignForm(f => ({ ...f, depositDollars: e.target.value }))} /></label>
                  <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button><button type="submit" className="btn btn-primary" disabled={modalLoading}>{modalLoading ? 'Assigning…' : 'Assign Lease'}</button></div>
                </form>
              </>
            )}

            {/* Edit Lease */}
            {modal === 'editLease' && (
              <>
                <div className="modal-header"><h2><Edit size={20} /> Edit Lease Terms</h2><button className="modal-close" onClick={closeModal}><X size={20} /></button></div>
                <form onSubmit={handleEditLease} className="modal-body">
                  {modalError && <div className="form-error"><AlertTriangle size={16} /> {modalError}</div>}
                  <label className="form-label">Monthly Rent ($)<input type="number" min="0" step="0.01" value={editLeaseForm.rentDollars} onChange={e => setEditLeaseForm(f => ({ ...f, rentDollars: e.target.value }))} /></label>
                  <label className="form-label">Security Deposit ($)<input type="number" min="0" step="0.01" value={editLeaseForm.depositDollars} onChange={e => setEditLeaseForm(f => ({ ...f, depositDollars: e.target.value }))} /></label>
                  <label className="form-label">End Date<input type="date" value={editLeaseForm.endDate} onChange={e => setEditLeaseForm(f => ({ ...f, endDate: e.target.value }))} /></label>
                  <label className="form-label">Grace Period (days)<input type="number" min="0" value={editLeaseForm.gracePeriodDays} onChange={e => setEditLeaseForm(f => ({ ...f, gracePeriodDays: e.target.value }))} /></label>
                  <label className="form-label">Status
                    <select value={editLeaseForm.status} onChange={e => setEditLeaseForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="">No change</option>
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="ended">Ended</option>
                    </select>
                  </label>
                  <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button><button type="submit" className="btn btn-primary" disabled={modalLoading}>{modalLoading ? 'Saving…' : 'Save Changes'}</button></div>
                </form>
              </>
            )}

            {/* Fee / Credit / Adjustment */}
            {modal === 'entry' && (
              <>
                <div className="modal-header"><h2><DollarSign size={20} /> Add {entryForm.type.charAt(0).toUpperCase() + entryForm.type.slice(1)}</h2><button className="modal-close" onClick={closeModal}><X size={20} /></button></div>
                <form onSubmit={handleAddEntry} className="modal-body">
                  {modalError && <div className="form-error"><AlertTriangle size={16} /> {modalError}</div>}
                  <label className="form-label">Type
                    <select value={entryForm.type} onChange={e => setEntryForm(f => ({ ...f, type: e.target.value as 'fee' | 'credit' | 'adjustment' }))}>
                      <option value="fee">Fee (increases balance)</option>
                      <option value="credit">Credit (reduces balance)</option>
                      <option value="adjustment">Adjustment (requires note)</option>
                    </select>
                  </label>
                  <label className="form-label">Statement
                    <select value={entryForm.statementId} onChange={e => setEntryForm(f => ({ ...f, statementId: e.target.value }))}>
                      {statements.map(s => <option key={s.id} value={s.id}>{s.month} — {fmt(s.balanceCents)} ({s.status})</option>)}
                    </select>
                  </label>
                  <label className="form-label">Label<input type="text" placeholder="e.g. Late fee, Rent adjustment" value={entryForm.label} onChange={e => setEntryForm(f => ({ ...f, label: e.target.value }))} required /></label>
                  <label className="form-label">Amount ($)<input type="number" min="0.01" step="0.01" value={entryForm.amountDollars} onChange={e => setEntryForm(f => ({ ...f, amountDollars: e.target.value }))} required /></label>
                  <label className="form-label">Notes {entryForm.type === 'adjustment' && <span style={{ color: '#dc2626' }}>*</span>}
                    <textarea value={entryForm.notes} onChange={e => setEntryForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Reason for this entry…" required={entryForm.type === 'adjustment'} />
                  </label>
                  <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button><button type="submit" className="btn btn-primary" disabled={modalLoading}>{modalLoading ? 'Adding…' : `Add ${entryForm.type}`}</button></div>
                </form>
              </>
            )}

            {/* Send Notice */}
            {modal === 'notice' && (
              <>
                <div className="modal-header"><h2><Send size={20} /> Send Notice</h2><button className="modal-close" onClick={closeModal}><X size={20} /></button></div>
                <form onSubmit={handleSendNotice} className="modal-body">
                  {modalError && <div className="form-error"><AlertTriangle size={16} /> {modalError}</div>}
                  <p className="notice-to">To: <strong>{tenant.displayName}</strong> ({tenant.email})</p>
                  <label className="form-label">Subject<input type="text" value={noticeForm.title} onChange={e => setNoticeForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Lease Renewal Notice" required /></label>
                  <label className="form-label">Message<textarea value={noticeForm.message} onChange={e => setNoticeForm(f => ({ ...f, message: e.target.value }))} rows={5} required /></label>
                  <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button><button type="submit" className="btn btn-primary" disabled={modalLoading}>{modalLoading ? 'Sending…' : 'Send Notice'}</button></div>
                </form>
              </>
            )}

            {/* Edit Contact */}
            {modal === 'editContact' && (
              <>
                <div className="modal-header"><h2><User size={20} /> Edit Contact</h2><button className="modal-close" onClick={closeModal}><X size={20} /></button></div>
                <form onSubmit={handleEditContact} className="modal-body">
                  {modalError && <div className="form-error"><AlertTriangle size={16} /> {modalError}</div>}
                  <label className="form-label">Phone<input type="tel" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} /></label>
                  <label className="form-label">Preferred Contact
                    <select value={contactForm.preferredContactMethod} onChange={e => setContactForm(f => ({ ...f, preferredContactMethod: e.target.value }))}>
                      <option value="">Default (email)</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="sms">SMS</option>
                    </select>
                  </label>
                  <h4 style={{ marginTop: '1rem' }}>Emergency Contact</h4>
                  <label className="form-label">Name<input type="text" value={contactForm.emergencyName} onChange={e => setContactForm(f => ({ ...f, emergencyName: e.target.value }))} /></label>
                  <label className="form-label">Phone<input type="tel" value={contactForm.emergencyPhone} onChange={e => setContactForm(f => ({ ...f, emergencyPhone: e.target.value }))} /></label>
                  <label className="form-label">Relationship<input type="text" value={contactForm.emergencyRelationship} onChange={e => setContactForm(f => ({ ...f, emergencyRelationship: e.target.value }))} /></label>
                  <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button><button type="submit" className="btn btn-primary" disabled={modalLoading}>{modalLoading ? 'Saving…' : 'Save Contact'}</button></div>
                </form>
              </>
            )}

            {/* Upload Lease Doc */}
            {modal === 'uploadDoc' && (
              <>
                <div className="modal-header"><h2><Upload size={20} /> Upload Lease Document</h2><button className="modal-close" onClick={closeModal}><X size={20} /></button></div>
                <form onSubmit={handleUploadDoc} className="modal-body">
                  {modalError && <div className="form-error"><AlertTriangle size={16} /> {modalError}</div>}
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg" onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                  <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={32} />
                    <p>{uploadFile ? uploadFile.name : 'Click to select a file'}</p>
                    <span className="muted">PDF, DOC, DOCX, PNG, JPG</span>
                  </div>
                  <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                    The document will be attached to this tenant's profile and marked for signature. {/* TODO: Tenant signing UI */}
                  </p>
                  <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button><button type="submit" className="btn btn-primary" disabled={modalLoading || !uploadFile}>{modalLoading ? 'Uploading…' : 'Upload & Send'}</button></div>
                </form>
              </>
            )}

            {/* Manage Occupants */}
            {modal === 'occupants' && (
              <>
                <div className="modal-header"><h2><Users size={20} /> Manage Occupants</h2><button className="modal-close" onClick={closeModal}><X size={20} /></button></div>
                <div className="modal-body">
                  {modalError && <div className="form-error"><AlertTriangle size={16} /> {modalError}</div>}
                  {/* Existing occupants */}
                  <h4>Current Occupants</h4>
                  {(lease?.occupants || []).length === 0 ? (
                    <p className="muted">No occupants on file. The primary tenant is {tenant.displayName}.</p>
                  ) : (
                    <div className="occupant-list">
                      {(lease?.occupants || []).map((o, i) => (
                        <div key={i} className="occupant-row">
                          <div>
                            <strong>{o.fullName}</strong> <span className="badge badge-sm badge-gray">{o.type}</span>
                            {o.email && <div className="muted">{o.email}</div>}
                            {o.phone && <div className="muted">{o.phone}</div>}
                          </div>
                          {o.type === 'secondary' && (
                            <button className="btn btn-ghost btn-icon btn-xs" onClick={() => handleRemoveOccupant(i)} title="Remove">
                              <UserMinus size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Add occupant form */}
                  <h4 style={{ marginTop: '1rem' }}>Add Occupant</h4>
                  <form onSubmit={handleAddOccupant}>
                    <label className="form-label">Full Name<input type="text" value={occupantForm.fullName} onChange={e => setOccupantForm(f => ({ ...f, fullName: e.target.value }))} required /></label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <label className="form-label">Email<input type="email" value={occupantForm.email} onChange={e => setOccupantForm(f => ({ ...f, email: e.target.value }))} /></label>
                      <label className="form-label">Phone<input type="tel" value={occupantForm.phone} onChange={e => setOccupantForm(f => ({ ...f, phone: e.target.value }))} /></label>
                    </div>
                    <label className="form-label">Notes<input type="text" value={occupantForm.notes} onChange={e => setOccupantForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" /></label>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={modalLoading} style={{ marginTop: '0.5rem' }}>
                      <UserPlus size={14} /> {modalLoading ? 'Adding…' : 'Add Occupant'}
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* Renew Lease */}
            {modal === 'renew' && (
              <>
                <div className="modal-header"><h2><Calendar size={20} /> Renew Lease</h2><button className="modal-close" onClick={closeModal}><X size={20} /></button></div>
                <form onSubmit={handleRenewLease} className="modal-body">
                  {modalError && <div className="form-error"><AlertTriangle size={16} /> {modalError}</div>}
                  <p>Current end date: <strong>{fmtDate(lease?.endDate)}</strong></p>
                  <label className="form-label">New End Date<input type="date" value={renewEndDate} onChange={e => setRenewEndDate(e.target.value)} required /></label>
                  <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button><button type="submit" className="btn btn-primary" disabled={modalLoading}>{modalLoading ? 'Renewing…' : 'Renew Lease'}</button></div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   TAB COMPONENTS
   ================================================================ */

function LeaseTab({ lease, allLeases, property, generatedLeases, fmtDate, fmtDollars, openAssign, openEditLease, openRenew, onEndLease, openOccupants, onVoidAndReset, tenantUid, navigate }: {
  lease: Lease | null;
  allLeases: Lease[];
  property: Property | null;
  generatedLeases: GeneratedLease[];
  fmtDate: (d: Date | string | null | undefined) => string;
  fmtDollars: (d: number) => string;
  openAssign: () => void;
  openEditLease: () => void;
  openRenew: () => void;
  onEndLease: () => void;
  openOccupants: () => void;
  onVoidAndReset: () => void;
  tenantUid: string;
  navigate: (path: string) => void;
}) {
  if (!lease) {
    return (
      <div className="tp-empty">
        <Home size={32} />
        <h3>No active lease assigned</h3>
        <button className="btn btn-primary" onClick={openAssign}><Plus size={16} /> Assign Property</button>
      </div>
    );
  }

  const latestGen = generatedLeases.find(g => g.signingStatus !== 'voided');
  const signingBadge = latestGen ? (
    latestGen.signingStatus === 'signed' ? <span className="badge badge-sm badge-success"><CheckCircle size={12} /> Signed</span>
    : latestGen.signingStatus === 'viewed' ? <span className="badge badge-sm badge-warning"><Clock size={12} /> Viewed</span>
    : latestGen.signingStatus === 'sent' ? <span className="badge badge-sm badge-warning"><Send size={12} /> Sent</span>
    : latestGen.signingStatus === 'generated' ? <span className="badge badge-sm badge-gray">Generated (not sent)</span>
    : <span className="badge badge-sm badge-gray">{latestGen.signingStatus}</span>
  ) : null;

  return (
    <div className="tp-lease-section">
      <div className="tp-section-header">
        <h3>Current Lease</h3>
        <div className="tp-section-actions">
          <button className="btn btn-sm btn-outline" onClick={openEditLease}><Edit size={14} /> Edit</button>
          <button className="btn btn-sm btn-outline" onClick={openRenew}><Calendar size={14} /> Renew</button>
          <button className="btn btn-sm btn-outline" onClick={onEndLease}><XCircle size={14} /> End</button>
        </div>
      </div>
      <div className="tp-detail-grid">
        <div><span className="tp-label">Property</span><span className="tp-value">{property ? `${property.address}${property.unit ? ` #${property.unit}` : ''}` : 'Unknown'}</span></div>
        <div><span className="tp-label">Status</span><span className="tp-value"><span className={`badge badge-${lease.status === 'active' ? 'success' : 'gray'}`}>{lease.status}</span></span></div>
        <div><span className="tp-label">Start Date</span><span className="tp-value">{fmtDate(lease.startDate)}</span></div>
        <div><span className="tp-label">End Date</span><span className="tp-value">{fmtDate(lease.endDate)}</span></div>
        <div><span className="tp-label">Monthly Rent</span><span className="tp-value">{fmtDollars(lease.monthlyRent)}</span></div>
        <div><span className="tp-label">Security Deposit</span><span className="tp-value">{fmtDollars(lease.securityDeposit)}</span></div>
        <div><span className="tp-label">Rent Due Day</span><span className="tp-value">{lease.rentDueDay || 1}st of month</span></div>
        <div><span className="tp-label">Grace Period</span><span className="tp-value">{lease.gracePeriodDays || 0} days</span></div>
      </div>

      {/* Lease Document Status */}
      <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Lease Document: </span>
            {signingBadge || <span className="badge badge-sm badge-gray">Not generated</span>}
            {latestGen?.signedAt && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>Signed {fmtDate(latestGen.signedAt)}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {!latestGen && (
              <button className="btn btn-sm btn-primary" onClick={() => navigate(`/admin/generate-lease?tenantId=${tenantUid}&leaseId=${lease.id}`)}>
                <FileText size={14} /> Generate Lease
              </button>
            )}
            {latestGen && latestGen.signingStatus !== 'signed' && (
              <button className="btn btn-sm btn-primary" onClick={() => navigate(`/admin/generate-lease?tenantId=${tenantUid}&leaseId=${lease.id}`)}>
                <FileText size={14} /> Regenerate
              </button>
            )}
            {latestGen && (
              <button className="btn btn-sm btn-outline" style={{ color: '#dc2626', borderColor: '#dc2626' }} onClick={onVoidAndReset}>
                <AlertTriangle size={14} /> Void &amp; Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {lease.occupants && lease.occupants.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <div className="tp-section-header">
            <h4>Occupants</h4>
            <button className="btn btn-ghost btn-icon btn-xs" onClick={openOccupants}><Edit size={14} /></button>
          </div>
          <div className="occupant-list">
            {lease.occupants.map((o, i) => (
              <div key={i} className="occupant-row compact">
                <span>{o.fullName}</span>
                <span className="badge badge-sm badge-gray">{o.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {allLeases.length > 1 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h4>Lease History</h4>
          <table className="mini-table">
            <thead><tr><th>Period</th><th>Property</th><th>Status</th><th>Rent</th></tr></thead>
            <tbody>
              {allLeases.map(l => (
                <tr key={l.id} className={l.id === lease.id ? 'active-row' : ''}>
                  <td>{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</td>
                  <td>{l.propertyId?.slice(0, 8)}…</td>
                  <td><span className={`badge badge-sm badge-${l.status === 'active' ? 'success' : 'gray'}`}>{l.status}</span></td>
                  <td>{fmtDollars(l.monthlyRent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatementsTab({ statements, selectedStatementId, setSelectedStatementId, ledgerEntries, ledgerLoading, fmt, fmtDate, openEntry }: {
  statements: RentStatement[];
  selectedStatementId: string | null;
  setSelectedStatementId: (id: string | null) => void;
  ledgerEntries: LedgerEntry[];
  ledgerLoading: boolean;
  fmt: (cents: number) => string;
  fmtDate: (d: Date | string | null | undefined) => string;
  openEntry: (type: 'fee' | 'credit' | 'adjustment') => void;
}) {
  if (statements.length === 0) {
    return <div className="tp-empty"><DollarSign size={32} /><h3>No statements</h3><p>Statements will appear after a lease is assigned.</p></div>;
  }

  return (
    <div>
      <div className="tp-section-header">
        <h3>Rent Statements</h3>
        <div className="tp-section-actions">
          <button className="btn btn-sm btn-outline" onClick={() => openEntry('fee')}><Plus size={14} /> Fee</button>
          <button className="btn btn-sm btn-outline" onClick={() => openEntry('credit')}><Minus size={14} /> Credit</button>
          <button className="btn btn-sm btn-outline" onClick={() => openEntry('adjustment')}><DollarSign size={14} /> Adjust</button>
        </div>
      </div>
      <div className="tp-statement-list">
        {statements.map(s => (
          <div key={s.id} className={`tp-statement-row ${selectedStatementId === s.id ? 'selected' : ''}`} onClick={() => setSelectedStatementId(selectedStatementId === s.id ? null : s.id)}>
            <div className="tp-stmt-month">{s.month}</div>
            <div className={`tp-stmt-balance ${s.balanceCents > 0 ? 'due' : ''}`}>{fmt(s.balanceCents)}</div>
            <span className={`badge badge-sm badge-${s.status === 'paid' ? 'success' : s.status === 'open' ? 'warning' : 'gray'}`}>{s.status}</span>
            <div className="tp-stmt-due">Due: {s.dueDate}</div>
          </div>
        ))}
      </div>
      {selectedStatementId && (
        <div className="tp-ledger">
          <h4>Ledger for {statements.find(s => s.id === selectedStatementId)?.month}</h4>
          {ledgerLoading ? <div className="spinner-sm" /> : ledgerEntries.length === 0 ? <p className="muted">No ledger entries.</p> : (
            <table className="mini-table">
              <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {ledgerEntries.map(e => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.effectiveDate)}</td>
                    <td><span className={`badge badge-sm badge-${e.type === 'payment' || e.type === 'credit' ? 'success' : e.type === 'charge' || e.type === 'fee' ? 'error' : 'gray'}`}>{e.type}</span></td>
                    <td>{e.label}{e.notes ? <span className="muted" style={{ marginLeft: '0.5rem' }}>({e.notes})</span> : ''}</td>
                    <td className={e.amountCents < 0 ? 'text-success' : 'text-error'}>{fmt(e.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentsTab({ payments, fmt, fmtDate }: { payments: Payment[]; fmt: (c: number) => string; fmtDate: (d: Date | string | null | undefined) => string }) {
  if (payments.length === 0) {
    return <div className="tp-empty"><CreditCard size={32} /><h3>No payment history</h3><p>Payments will appear when the tenant makes payments.</p></div>;
  }

  return (
    <div>
      <h3>Payment History</h3>
      <table className="mini-table">
        <thead><tr><th>Date</th><th>Amount</th><th>Type</th><th>Method</th><th>Status</th><th>Stripe ID</th></tr></thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id}>
              <td>{fmtDate(p.createdAt)}</td>
              <td>{fmt(p.amount)}</td>
              <td className="capitalize">{p.type?.replace('_', ' ') || '—'}</td>
              <td className="capitalize">{p.method?.replace('_', ' ') || '—'}</td>
              <td><span className={`badge badge-sm badge-${p.status === 'completed' ? 'success' : p.status === 'failed' ? 'error' : 'warning'}`}>{p.status}</span></td>
              <td className="muted">{p.stripePaymentIntentId?.slice(0, 12) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsTab({ documents, fmtDate, openUploadDoc, onVoidDoc }: { documents: PortalDocument[]; fmtDate: (d: Date | string | null | undefined) => string; openUploadDoc: () => void; onVoidDoc: (docId: string) => void }) {
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, { original?: string; signed?: string }>>({});

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      const urls: Record<string, { original?: string; signed?: string }> = {};
      for (const doc of documents) {
        const entry: { original?: string; signed?: string } = {};
        try {
          if (doc.originalFilePath) entry.original = await getFileUrl(doc.originalFilePath);
        } catch { /* ignore */ }
        try {
          if (doc.signedFilePath) entry.signed = await getFileUrl(doc.signedFilePath);
        } catch { /* ignore */ }
        urls[doc.id] = entry;
      }
      if (!cancelled) setResolvedUrls(urls);
    }
    if (documents.length > 0) resolve();
    return () => { cancelled = true; };
  }, [documents]);

  return (
    <div>
      <div className="tp-section-header">
        <h3>Documents</h3>
        <button className="btn btn-sm btn-primary" onClick={openUploadDoc}><Upload size={14} /> Upload Lease Doc</button>
      </div>
      {documents.length === 0 ? (
        <div className="tp-empty">
          <FileText size={32} />
          <h3>No documents</h3>
          <button className="btn btn-primary" onClick={openUploadDoc}><Upload size={16} /> Upload Lease Document</button>
        </div>
      ) : (
        <table className="mini-table">
          <thead><tr><th>File</th><th>Category</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {documents.map(doc => {
              const urls = resolvedUrls[doc.id];
              return (
                <tr key={doc.id} style={doc.status === 'void' ? { opacity: 0.5 } : undefined}>
                  <td>{doc.fileName}</td>
                  <td><span className="badge badge-sm badge-gray">{doc.category}</span></td>
                  <td>
                    {doc.status === 'signed' ? <span className="badge badge-sm badge-success"><CheckCircle size={12} /> Signed</span>
                      : doc.status === 'void' ? <span className="badge badge-sm badge-gray">Void</span>
                      : doc.status === 'sent' || doc.status === 'pending_signature' ? <span className="badge badge-sm badge-warning"><Clock size={12} /> Pending</span>
                      : <span className="badge badge-sm badge-gray">{doc.status}</span>}
                  </td>
                  <td>{fmtDate(doc.createdAt)}</td>
                  <td style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    {urls?.original && <a href={urls.original} target="_blank" rel="noopener noreferrer" title="Download"><Download size={16} /></a>}
                    {urls?.signed && <a href={urls.signed} target="_blank" rel="noopener noreferrer" title="Signed copy" style={{ marginLeft: '0.5rem' }}><CheckCircle size={16} /></a>}
                    {doc.status !== 'void' && (
                      <button className="btn btn-sm btn-outline" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }} onClick={() => onVoidDoc(doc.id)} title="Void this document">Void</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MaintenanceTab({ tickets, fmtDate }: { tickets: MaintenanceTicket[]; fmtDate: (d: Date | string | null | undefined) => string }) {
  const sorted = [...tickets].sort((a, b) => {
    const order = ['new', 'in_progress', 'waiting', 'completed', 'archived'];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  if (sorted.length === 0) {
    return <div className="tp-empty"><Wrench size={32} /><h3>No maintenance requests</h3></div>;
  }

  return (
    <div>
      <h3>Maintenance Requests</h3>
      <table className="mini-table">
        <thead><tr><th>Date</th><th>Category</th><th>Priority</th><th>Description</th><th>Status</th></tr></thead>
        <tbody>
          {sorted.map(t => (
            <tr key={t.id}>
              <td>{fmtDate(t.createdAt)}</td>
              <td className="capitalize">{t.category}</td>
              <td><span className={`badge badge-sm badge-${t.priority === 'emergency' ? 'error' : t.priority === 'high' ? 'warning' : 'gray'}`}>{t.priority}</span></td>
              <td>{t.description.length > 60 ? t.description.slice(0, 60) + '…' : t.description}</td>
              <td><span className={`badge badge-sm badge-${t.status === 'completed' ? 'success' : t.status === 'new' ? 'info' : 'warning'}`}>{t.status.replace('_', ' ')}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InspectionTab({ inspections, fmtDate }: { inspections: MoveInInspection[]; fmtDate: (d: Date | string | null | undefined) => string }) {
  if (inspections.length === 0) {
    return <div className="tp-empty"><CheckCircle size={32} /><h3>No move-in inspections</h3></div>;
  }

  return (
    <div>
      <h3>Move-in Inspections</h3>
      {inspections.map(ins => (
        <div key={ins.id} style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className={`badge badge-sm badge-${ins.status === 'submitted' ? 'success' : ins.status === 'in_progress' ? 'warning' : 'gray'}`}>
              {ins.status.replace('_', ' ')}
            </span>
            {ins.submittedAt && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Submitted {fmtDate(ins.submittedAt)}</span>}
          </div>
          {ins.responses.length > 0 && (
            <table className="mini-table">
              <thead><tr><th>Item</th><th>Type</th><th>Response</th></tr></thead>
              <tbody>
                {ins.responses.map(r => (
                  <tr key={r.fieldId}>
                    <td>{r.label}</td>
                    <td className="capitalize">{r.type}</td>
                    <td>{r.type === 'check' ? (r.value === 'true' ? '✓' : '✗') : r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

function NoticesTab({ notices, fmtDate, openNotice }: { notices: Alert[]; fmtDate: (d: Date | string | null | undefined) => string; openNotice: () => void }) {
  return (
    <div>
      <div className="tp-section-header">
        <h3>Notices</h3>
        <button className="btn btn-sm btn-primary" onClick={openNotice}><Send size={14} /> Send Notice</button>
      </div>
      {notices.length === 0 ? (
        <div className="tp-empty">
          <Bell size={32} />
          <h3>No notices sent</h3>
          <button className="btn btn-primary" onClick={openNotice}><Send size={16} /> Send Notice</button>
        </div>
      ) : (
        <table className="mini-table">
          <thead><tr><th>Date</th><th>Subject</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            {notices.map(n => (
              <tr key={n.id}>
                <td>{fmtDate(n.createdAt)}</td>
                <td>{n.title}</td>
                <td><span className="badge badge-sm badge-gray">{n.type}</span></td>
                <td>{n.read ? <span className="badge badge-sm badge-success">Read</span> : <span className="badge badge-sm badge-warning">Unread</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ActivityTab({ activity, fmtDate }: { activity: ActivityLog[]; fmtDate: (d: Date | string | null | undefined) => string }) {
  const formatAction = (action: string) => {
    const labels: Record<string, string> = {
      lease_assigned: 'Lease Assigned', lease_ended: 'Lease Ended', lease_edited: 'Lease Edited',
      lease_renewed: 'Lease Renewed', fee_added: 'Fee Added', credit_added: 'Credit Applied',
      adjustment_added: 'Adjustment Added', payment_recorded: 'Payment Recorded',
      document_sent: 'Document Sent', document_signed: 'Document Signed', lease_doc_uploaded: 'Lease Doc Uploaded',
      notice_sent: 'Notice Sent', contact_updated: 'Contact Updated',
      occupant_added: 'Occupant Added', occupant_removed: 'Occupant Removed',
      maintenance_created: 'Maintenance Created', maintenance_updated: 'Maintenance Updated',
    };
    return labels[action] || action.replace(/_/g, ' ');
  };

  if (activity.length === 0) {
    return <div className="tp-empty"><Clock size={32} /><h3>No activity recorded</h3><p>Activity will appear here as admin actions are performed for this tenant.</p></div>;
  }

  return (
    <div>
      <h3>Activity Feed</h3>
      <ul className="tp-activity-list">
        {activity.map(a => (
          <li key={a.id} className="tp-activity-item">
            <div className="tp-activity-dot" />
            <div className="tp-activity-content">
              <div className="tp-activity-title">{formatAction(a.action)}</div>
              <div className="tp-activity-meta">
                {a.metadata && typeof a.metadata === 'object' && Object.values(a.metadata).filter(v => typeof v === 'string').slice(0, 2).join(' • ')}
                <span className="tp-activity-date">{fmtDate(a.createdAt)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
