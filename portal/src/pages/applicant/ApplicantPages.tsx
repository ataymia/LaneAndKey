import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  User,
  Plus,
  Search,
  MapPin,
  Bed,
  Bath,
  Square,
  CheckCircle,
  Clock,
  XCircle,
  Bell,
  Save,
  Home,
  Upload,
  FileText,
  Download,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { conversationService, messageService, userService, applicationService, propertyService, portalDocumentService } from '../../lib/firebase';
import { uploadFile } from '../../lib/firebase/storage';
import type { Conversation, Message, UserProfile, Property, Application, ApplicantProfile } from '../../types';
import { createAdminAlert } from '../../lib/firebase/adminAlerts';

// ─── Helpers ───
function getStatusBadge(status: string) {
  switch (status) {
    case 'new': return <span className="badge badge-info"><Clock size={12} /> Submitted</span>;
    case 'in_review': return <span className="badge badge-warning"><Clock size={12} /> In Review</span>;
    case 'approved': return <span className="badge badge-success"><CheckCircle size={12} /> Approved</span>;
    case 'declined': return <span className="badge badge-danger"><XCircle size={12} /> Declined</span>;
    case 'withdrawn': return <span className="badge badge-gray"><XCircle size={12} /> Withdrawn</span>;
    case 'archived': return <span className="badge badge-gray">{status}</span>;
    default: return <span className="badge badge-gray">{status}</span>;
  }
}

const ACTIVE_STATUSES = ['new', 'in_review', 'approved'];
const DENIED_REAPPLY_DAYS = 30;

function canApply(existingApps: Application[], propertyId: string): { allowed: boolean; reason?: string; nextDate?: Date } {
  const appsForProp = existingApps.filter(a => a.propertyId === propertyId);
  if (appsForProp.length === 0) return { allowed: true };

  const sorted = [...appsForProp].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latest = sorted[0];

  if (ACTIVE_STATUSES.includes(latest.status)) {
    return { allowed: false, reason: `You already have an active application (${latest.status === 'new' ? 'submitted' : latest.status.replace('_', ' ')})` };
  }
  if (latest.status === 'declined') {
    const deniedAt = latest.deniedAt ? new Date(latest.deniedAt) : new Date(latest.updatedAt);
    const nextDate = new Date(deniedAt.getTime() + DENIED_REAPPLY_DAYS * 24 * 60 * 60 * 1000);
    if (new Date() < nextDate) {
      return { allowed: false, reason: `Reapply available after ${nextDate.toLocaleDateString()}`, nextDate };
    }
  }
  return { allowed: true };
}

const emptyProfile: ApplicantProfile = {
  fullName: '', phone: '', dateOfBirth: '', monthlyIncome: 0,
  employer: '', employerPhone: '', currentAddress: '', moveInDate: '', additionalNotes: '',
};

// ─── Applications Page ───
export function ApplicantApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<(Application & { propertyAddress?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadApps(); }, [user]);

  const loadApps = async () => {
    if (!user) return;
    try {
      const apps = await applicationService.getByApplicant(user.uid);
      const enriched = await Promise.all(apps.map(async (app) => {
        try {
          const prop = await propertyService.get(app.propertyId);
          return { ...app, propertyAddress: prop ? `${prop.address}, ${prop.city}` : 'Unknown property' };
        } catch { return { ...app, propertyAddress: 'Unknown property' }; }
      }));
      enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setApplications(enriched);
    } catch (error) { console.error('Error loading applications:', error); }
    finally { setLoading(false); }
  };

  const withdrawApp = async (appId: string) => {
    if (!confirm('Are you sure you want to withdraw this application?')) return;
    try {
      await applicationService.update(appId, {
        status: 'withdrawn',
        withdrawnAt: new Date(),
      } as any);
      const updated = await applicationService.get(appId);
      if (updated && updated.status === 'withdrawn') {
        setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'withdrawn', withdrawnAt: new Date() } : a));
      } else {
        alert('Failed to withdraw application. Please try again.');
      }
    } catch (error) {
      console.error('Error withdrawing application:', error);
      alert('Failed to withdraw application. Please try again.');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Applications</h1>
        <p>Track your submitted applications</p>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading...</div>
      ) : applications.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {applications.map(app => (
            <div key={app.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', flexWrap: 'wrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', flexShrink: 0 }}>
                <Home size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{app.propertyAddress}</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  Applied {new Date(app.createdAt).toLocaleDateString()}
                  {app.withdrawnAt && ` · Withdrawn ${new Date(app.withdrawnAt).toLocaleDateString()}`}
                  {app.deniedAt && ` · Denied ${new Date(app.deniedAt).toLocaleDateString()}`}
                  {app.approvedAt && ` · Approved ${new Date(app.approvedAt).toLocaleDateString()}`}
                </div>
              </div>
              <div>{getStatusBadge(app.status)}</div>
              {(app.status === 'new' || app.status === 'in_review') && (
                <button className="btn btn-sm btn-outline" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => withdrawApp(app.id)}>
                  Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <h3 className="empty-state-title">No applications yet</h3>
          <p className="empty-state-description">Browse available properties and submit your first application.</p>
          <Link to="/applicant/listings" className="btn btn-primary">Browse Properties</Link>
        </div>
      )}
    </div>
  );
}

// ─── Documents Page ───
export function ApplicantDocumentsPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('id');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user) loadDocs(); }, [user]);

  const loadDocs = async () => {
    if (!user) return;
    try {
      const data = await portalDocumentService.getByOwner(user.uid);
      setDocs(data);
    } catch (error) { console.error('Error loading documents:', error); }
    finally { setLoading(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { alert('Only PDF, JPEG, PNG, or WebP files are allowed.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('File must be under 10 MB.'); return; }
    setUploading(true);
    try {
      const storagePath = `documents/${user.uid}/${category}/${Date.now()}_${file.name}`;
      const downloadUrl = await uploadFile(storagePath, file);
      await portalDocumentService.create({
        ownerUid: user.uid,
        uploadedByUid: user.uid,
        title: file.name,
        category,
        status: 'uploaded' as any,
        storagePath,
        downloadUrl,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      } as any);
      await loadDocs();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case 'id': return 'ID / Driver License';
      case 'pay_stub': return 'Pay Stub';
      case 'bank_statement': return 'Bank Statement';
      case 'tax_return': return 'Tax Return';
      default: return cat;
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Documents</h1>
        <p>Upload documents for your application</p>
      </div>
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem', maxWidth: 500 }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Upload a Document</h3>
        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label className="form-label">Category</label>
          <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="id">ID / Driver License</option>
            <option value="pay_stub">Pay Stub</option>
            <option value="bank_statement">Bank Statement</option>
            <option value="tax_return">Tax Return</option>
            <option value="other">Other</option>
          </select>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleUpload} style={{ display: 'none' }} />
        <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload size={16} /> {uploading ? 'Uploading...' : 'Choose File & Upload'}
        </button>
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>PDF, JPEG, PNG, or WebP — max 10 MB</p>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading...</div>
      ) : docs.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {docs.map((d: any) => (
            <div key={d.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem' }}>
              <FileText size={20} style={{ color: '#6366f1', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title || d.fileName}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{categoryLabel(d.category)} · {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ''}</div>
              </div>
              {d.downloadUrl && (
                <a href={d.downloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline" title="Download"><Download size={14} /></a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <h3 className="empty-state-title">No documents yet</h3>
          <p className="empty-state-description">Upload documents above to support your applications.</p>
        </div>
      )}
    </div>
  );
}

// ─── Messages Page ───
export function ApplicantMessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [creatingConvo, setCreatingConvo] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(true);

  useEffect(() => { if (user) loadConversations(); }, [user]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadConversations = async () => {
    if (!user) return;
    try {
      const data = await conversationService.getByParticipant(user.uid);
      setConversations(data);
      const names: Record<string, string> = {};
      for (const c of data) {
        for (const uid of c.participantIds) {
          if (uid !== user.uid && !names[uid]) {
            try { const p = await userService.get(uid); if (p) names[uid] = p.displayName || p.email; } catch { /* skip */ }
          }
        }
      }
      setParticipantNames(names);
    } catch (error) { console.error('Error:', error); } finally { setLoading(false); }
  };

  const loadMessages = async (id: string) => {
    try {
      const data = await messageService.getByConversation(id);
      setMessages(data);
      for (const msg of data) {
        if (!msg.read && msg.senderId !== user?.uid) messageService.markAsRead(msg.id).catch(() => {});
      }
    } catch (error) { console.error('Error:', error); }
  };

  const selectConversation = (conv: Conversation) => { setSelectedConversation(conv); loadMessages(conv.id); setMobilePanelOpen(false); };

  const sendMsg = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;
    try {
      await messageService.create({ conversationId: selectedConversation.id, senderId: user.uid, senderRole: 'applicant', content: newMessage, read: false });
      await conversationService.update(selectedConversation.id, { lastMessage: newMessage, lastMessageAt: new Date() });
      await loadMessages(selectedConversation.id);
      setNewMessage('');
      loadConversations();
    } catch (error) { console.error('Error:', error); }
  };

  const openNewConvo = async () => {
    setShowNewConvo(true);
    try { setAdmins(await userService.getByRole('admin')); } catch { /* skip */ }
  };

  const startConvo = async (admin: UserProfile) => {
    if (!user) return;
    const existing = conversations.find(c => c.type === 'direct' && c.participantIds.includes(admin.uid) && c.participantIds.includes(user.uid));
    if (existing) { setShowNewConvo(false); selectConversation(existing); return; }
    try {
      setCreatingConvo(true);
      const id = await conversationService.create({ type: 'direct', participantIds: [user.uid, admin.uid], lastMessage: '', lastMessageAt: new Date() });
      await loadConversations();
      const nc = await conversationService.get(id);
      if (nc) { setParticipantNames(p => ({ ...p, [admin.uid]: admin.displayName || admin.email })); selectConversation(nc); }
      setShowNewConvo(false);
    } catch (error) { console.error('Error:', error); } finally { setCreatingConvo(false); }
  };

  const getConvoName = (conv: Conversation) => {
    const otherId = conv.participantIds.find(id => id !== user?.uid);
    if (otherId && participantNames[otherId]) return participantNames[otherId];
    return 'Property Manager';
  };

  return (
    <div className="messages-page">
      <div className="messages-container">
        <div className={`conversations-panel${mobilePanelOpen ? ' show' : ''}`}>
          <div className="panel-header">
            <div className="panel-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Messages</h2>
              <button className="btn btn-sm btn-primary" onClick={openNewConvo}><Plus size={16} /></button>
            </div>
          </div>
          <div className="conversations-list">
            {loading ? (
              <div className="loading-conversations">{[1,2,3].map(i => <div key={i} className="skeleton conversation-skeleton" />)}</div>
            ) : conversations.length > 0 ? conversations.map(conv => (
              <div key={conv.id} className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                onClick={() => selectConversation(conv)}>
                <div className="conversation-icon"><User size={18} /></div>
                <div className="conversation-info">
                  <div className="conversation-name">{getConvoName(conv)}</div>
                  <div className="conversation-preview">{conv.lastMessage || 'No messages yet'}</div>
                </div>
                {conv.lastMessageAt && <div className="conversation-time">{new Date(conv.lastMessageAt).toLocaleDateString()}</div>}
              </div>
            )) : (
              <div className="no-conversations">
                <MessageSquare size={32} />
                <p>No conversations</p>
                <button className="btn btn-sm btn-primary" onClick={openNewConvo} style={{ marginTop: '0.5rem' }}><Plus size={14} /> New Message</button>
              </div>
            )}
          </div>
        </div>
        <div className="messages-panel">
          {selectedConversation ? (
            <>
              <div className="panel-header">
                <button className="btn btn-sm btn-outline mobile-back-btn" onClick={() => { setSelectedConversation(null); setMobilePanelOpen(true); }}>← Back</button>
                <div className="selected-conversation">
                  <div className="conversation-icon"><User size={18} /></div>
                  <div><h3>{getConvoName(selectedConversation)}</h3></div>
                </div>
              </div>
              <div className="messages-list">
                {messages.length === 0 ? (
                  <div className="no-messages-hint"><p>Send the first message below!</p></div>
                ) : messages.map(msg => (
                  <div key={msg.id} className={`message ${msg.senderId === user?.uid ? 'sent' : 'received'}`}>
                    <div className="message-content">{msg.content}</div>
                    <div className="message-time">{new Date(msg.createdAt).toLocaleTimeString()}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="message-input">
                <input type="text" placeholder="Type a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} />
                <button onClick={sendMsg} disabled={!newMessage.trim()}><Send size={18} /></button>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <MessageSquare size={48} />
              <h3>Select a conversation</h3>
              <p>Choose from the list or start a new message</p>
              <button className="btn btn-outline mobile-back-btn" onClick={() => setMobilePanelOpen(true)} style={{ marginTop: '0.5rem' }}>← Show List</button>
              <button className="btn btn-primary" onClick={openNewConvo} style={{ marginTop: '1rem' }}><Plus size={18} /> New Message</button>
            </div>
          )}
        </div>
      </div>
      {showNewConvo && (
        <div className="modal-overlay" onClick={() => setShowNewConvo(false)}>
          <div className="modal new-convo-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><MessageSquare size={20} /> Message Property Manager</h2>
              <button className="modal-close" onClick={() => setShowNewConvo(false)}><XCircle size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="user-picker-list">
                {admins.length > 0 ? admins.map(a => (
                  <div key={a.uid} className="user-picker-item" onClick={() => !creatingConvo && startConvo(a)}>
                    <div className="user-picker-avatar"><User size={18} /></div>
                    <div className="user-picker-info">
                      <div className="user-picker-name">{a.displayName || 'Property Manager'}</div>
                      <div className="user-picker-email">{a.email}</div>
                    </div>
                  </div>
                )) : <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>No property managers found</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Page ───
export function ApplicantSettingsPage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [statusAlerts, setStatusAlerts] = useState(true);

  useEffect(() => { if (user) { setDisplayName(user.displayName || ''); loadPrefs(); } }, [user]);

  const loadPrefs = async () => {
    if (!user) return;
    try {
      const profile = await userService.get(user.uid);
      if (profile) {
        setPhone((profile as any).phone || '');
        if ((profile as any).notifications) {
          setEmailNotifications((profile as any).notifications.email !== false);
          setStatusAlerts((profile as any).notifications.statusAlerts !== false);
        }
      }
    } catch (err) { console.error('Failed to load prefs:', err); }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true); setSaved(false);
    try {
      await userService.update(user.uid, { displayName, phone, notifications: { email: emailNotifications, statusAlerts } } as any);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error('Failed to save settings:', err); }
    finally { setSaving(false); }
  };

  return (
    <div className="page">
      <div className="page-header"><h1>Settings</h1><p>Manage your account preferences</p></div>
      <div className="card" style={{ maxWidth: 600, padding: '1.5rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Profile</h3>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">Display Name</label>
          <input className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">Email</label>
          <input className="form-input" value={user?.email || ''} disabled style={{ background: '#f3f4f6' }} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Phone</label>
          <input className="form-input" placeholder="(555) 123-4567" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="card" style={{ maxWidth: 600, padding: '1.5rem', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Notifications</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
          <input type="checkbox" checked={emailNotifications} onChange={e => setEmailNotifications(e.target.checked)} /><span>Email notifications</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={statusAlerts} onChange={e => setStatusAlerts(e.target.checked)} /><span>Application status alerts</span>
        </label>
      </div>
      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ maxWidth: 600 }}>
        <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
      </button>
      {saved && <div style={{ color: '#16a34a', marginTop: '0.5rem', fontSize: '0.875rem' }}>Settings saved successfully!</div>}
    </div>
  );
}

// ─── Alerts Page ───
export function ApplicantAlertsPage() {
  return (
    <div className="page">
      <div className="page-header"><h1>Alerts</h1><p>Stay up to date on your applications</p></div>
      <div className="empty-state">
        <div className="empty-state-icon"><Bell size={32} /></div>
        <h3 className="empty-state-title">No alerts</h3>
        <p className="empty-state-description">You'll be notified here when there are updates on your applications.</p>
      </div>
    </div>
  );
}

// ─── Listings / Browse Properties Page ───
export function ApplicantListingsPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [myApps, setMyApps] = useState<Application[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [applyingProperty, setApplyingProperty] = useState<Property | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [savedProfile, setSavedProfile] = useState<ApplicantProfile | null>(null);
  const [formData, setFormData] = useState<ApplicantProfile>({ ...emptyProfile });

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    try {
      const [allProps, apps, profile] = await Promise.all([
        propertyService.getAll(),
        user ? applicationService.getByApplicant(user.uid) : Promise.resolve([]),
        user ? userService.get(user.uid) : Promise.resolve(null),
      ]);
      setProperties(allProps.filter((p: any) => p.marketStatus === 'on' || !p.marketStatus));
      setMyApps(apps);
      const ap = (profile as any)?.applicantProfile as ApplicantProfile | undefined;
      if (ap && ap.fullName) setSavedProfile(ap);
    } catch (err) { console.error('Error loading listings:', err); }
    finally { setLoading(false); }
  };

  const openApplyForm = (prop: Property) => {
    setApplyingProperty(prop);
    setSubmitError('');
    if (savedProfile) {
      setFormData({ ...savedProfile });
    } else {
      setFormData({ ...emptyProfile, fullName: user?.displayName || '' });
    }
  };

  const handleSubmitApplication = async () => {
    if (!user || !applyingProperty) return;
    if (!formData.fullName.trim() || !formData.phone.trim() || !formData.dateOfBirth || !formData.employer.trim()) {
      setSubmitError('Please fill in all required fields (name, phone, DOB, employer).');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const eligibility = canApply(myApps, applyingProperty.id);
      if (!eligibility.allowed) {
        setSubmitError(eligibility.reason || 'Cannot apply at this time.');
        setSubmitting(false);
        return;
      }
      const snapshot: ApplicantProfile = { ...formData };
      const appId = await applicationService.create({
        propertyId: applyingProperty.id,
        householdId: '',
        primaryApplicantId: user.uid,
        coApplicantIds: [],
        desiredMoveInDate: formData.moveInDate ? new Date(formData.moveInDate) : new Date(),
        status: 'new',
        documents: [] as any,
        notes: formData.additionalNotes || '',
        timeline: [{
          id: Date.now().toString(),
          event: 'submitted',
          description: 'Application submitted by applicant',
          date: new Date(),
          userId: user.uid,
        }],
        applicantSnapshot: snapshot,
        submittedAt: new Date(),
      } as any);
      // Verify write
      const created = await applicationService.get(appId);
      if (!created) throw new Error('Application was not created. Firestore write may have been rejected.');
      // Save profile for Quick Apply
      await userService.update(user.uid, { applicantProfile: snapshot } as any);
      setSavedProfile(snapshot);
      createAdminAlert({
        type: 'general',
        title: 'New Application Submitted',
        message: `${formData.fullName} submitted an application for ${applyingProperty.address}, ${applyingProperty.city}.`,
        relatedId: appId,
        relatedType: 'application',
      });
      const updatedApps = await applicationService.getByApplicant(user.uid);
      setMyApps(updatedApps);
      setApplyingProperty(null);
    } catch (err: any) {
      console.error('Error submitting application:', err);
      setSubmitError(err.message || 'Failed to submit application. Please try again.');
    } finally { setSubmitting(false); }
  };

  const filtered = properties.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.address?.toLowerCase().includes(q) || p.city?.toLowerCase().includes(q) || p.state?.toLowerCase().includes(q);
  });

  const fmt = (n: number | undefined) => n ? `$${n.toLocaleString()}` : '—';

  return (
    <div className="page">
      <div className="page-header"><h1>Browse Properties</h1><p>Find and apply to available rentals</p></div>
      <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: 400 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input className="form-input" placeholder="Search by address, city..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading properties...</div>
      ) : filtered.length > 0 ? (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {filtered.map(prop => {
            const eligibility = canApply(myApps, prop.id);
            const hasActiveApp = myApps.some(a => a.propertyId === prop.id && ACTIVE_STATUSES.includes(a.status));
            const photos = prop.photos || [];
            return (
              <div key={prop.id} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 160, background: '#f3f4f6', overflow: 'hidden' }}>
                  {photos[0]
                    ? <img src={photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db' }}><Home size={40} /></div>}
                </div>
                <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>{fmt(prop.monthlyRent)}/mo</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={13} /> {prop.address}, {prop.city}, {prop.state}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                    {prop.bedrooms != null && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Bed size={13} /> {prop.bedrooms} bed</span>}
                    {prop.bathrooms != null && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Bath size={13} /> {prop.bathrooms} bath</span>}
                    {prop.sqft != null && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Square size={13} /> {prop.sqft} sqft</span>}
                  </div>
                  <div style={{ marginTop: 'auto' }}>
                    {hasActiveApp ? (
                      <button className="btn btn-sm" disabled style={{ width: '100%', background: '#d1fae5', color: '#059669', border: 'none' }}>
                        <CheckCircle size={14} /> Applied
                      </button>
                    ) : !eligibility.allowed ? (
                      <button className="btn btn-sm" disabled style={{ width: '100%', background: '#fee2e2', color: '#b91c1c', border: 'none', fontSize: '0.75rem' }}>
                        <AlertCircle size={14} /> {eligibility.reason}
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => openApplyForm(prop)}>
                        {savedProfile ? <><Zap size={14} /> Quick Apply</> : 'Apply Now'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><Home size={32} /></div>
          <h3 className="empty-state-title">No properties found</h3>
          <p className="empty-state-description">{search ? 'Try a different search term.' : 'No properties are currently listed. Check back soon!'}</p>
        </div>
      )}

      {/* Application Form Modal */}
      {applyingProperty && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
          onClick={() => !submitting && setApplyingProperty(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>{savedProfile ? '⚡ Quick Apply' : 'Apply for Property'}</h2>
            <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.875rem' }}>{applyingProperty.address}, {applyingProperty.city} — {fmt(applyingProperty.monthlyRent)}/mo</p>
            {savedProfile && (
              <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#4338ca' }}>
                <Zap size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Pre-filled from your saved profile. Review and submit.
              </div>
            )}
            {submitError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#b91c1c' }}>
                <AlertCircle size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {submitError}
              </div>
            )}
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={formData.fullName} onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input className="form-input" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth *</label>
                  <input className="form-input" type="date" value={formData.dateOfBirth} onChange={e => setFormData(p => ({ ...p, dateOfBirth: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Employer *</label>
                  <input className="form-input" value={formData.employer} onChange={e => setFormData(p => ({ ...p, employer: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Income</label>
                  <input className="form-input" type="number" value={formData.monthlyIncome || ''} onChange={e => setFormData(p => ({ ...p, monthlyIncome: Number(e.target.value) }))} placeholder="$0" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Current Address</label>
                <input className="form-input" value={formData.currentAddress || ''} onChange={e => setFormData(p => ({ ...p, currentAddress: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Desired Move-in Date</label>
                <input className="form-input" type="date" value={formData.moveInDate || ''} onChange={e => setFormData(p => ({ ...p, moveInDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Additional Notes</label>
                <textarea className="form-input" rows={3} value={formData.additionalNotes || ''} onChange={e => setFormData(p => ({ ...p, additionalNotes: e.target.value }))} placeholder="Anything else you'd like us to know..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setApplyingProperty(null)} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmitApplication} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
