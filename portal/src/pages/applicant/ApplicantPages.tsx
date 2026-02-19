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
} from 'lucide-react';
import { conversationService, messageService, userService, applicationService, propertyService } from '../../lib/firebase';
import type { Conversation, Message, UserProfile, Property, Application } from '../../types';

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
      setApplications(enriched);
    } catch (error) { console.error('Error loading applications:', error); }
    finally { setLoading(false); }
  };

  const withdrawApp = async (appId: string) => {
    if (!confirm('Are you sure you want to withdraw this application?')) return;
    try {
      await applicationService.update(appId, { status: 'withdrawn' });
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'withdrawn' } : a));
    } catch (error) { console.error('Error withdrawing application:', error); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new': case 'submitted': return <span className="badge badge-info"><Clock size={12} /> Submitted</span>;
      case 'in_review': return <span className="badge badge-warning"><Clock size={12} /> In Review</span>;
      case 'approved': return <span className="badge badge-success"><CheckCircle size={12} /> Approved</span>;
      case 'declined': return <span className="badge badge-danger"><XCircle size={12} /> Declined</span>;
      case 'withdrawn': return <span className="badge badge-gray"><XCircle size={12} /> Withdrawn</span>;
      default: return <span className="badge badge-gray">{status}</span>;
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
                </div>
              </div>
              <div>{getStatusBadge(app.status)}</div>
              {(app.status === 'new' || app.status === 'submitted' || app.status === 'in_review') && (
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
  return (
    <div className="page">
      <div className="page-header">
        <h1>Documents</h1>
        <p>Upload documents for your application</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">📁</div>
        <h3 className="empty-state-title">No documents</h3>
        <p className="empty-state-description">
          Upload required documents for your application.
        </p>
      </div>
    </div>
  );
}

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

  const selectConversation = (conv: Conversation) => { setSelectedConversation(conv); loadMessages(conv.id); };

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
    <div className="page" style={{ height: 'calc(100vh - 8rem)' }}>
      <div style={{ display: 'flex', height: '100%', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ width: 280, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Messages</h2>
            <button className="btn btn-sm btn-primary" onClick={openNewConvo}><Plus size={16} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
            : conversations.length > 0 ? conversations.map(conv => (
              <div key={conv.id} onClick={() => selectConversation(conv)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f9fafb', background: selectedConversation?.id === conv.id ? '#eef2ff' : 'transparent' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', flexShrink: 0 }}>
                  <User size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{getConvoName(conv)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.lastMessage || 'No messages yet'}</div>
                </div>
              </div>
            )) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                <MessageSquare size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <p>No conversations</p>
                <button className="btn btn-sm btn-primary" onClick={openNewConvo} style={{ marginTop: '0.5rem' }}><Plus size={14} /> New Message</button>
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedConversation ? (
            <>
              <div style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}><User size={18} /></div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{getConvoName(selectedConversation)}</h3>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#f9fafb' }}>
                {messages.length === 0 ? <div style={{ textAlign: 'center', color: '#9ca3af', margin: 'auto' }}>Send the first message below!</div>
                : messages.map(msg => (
                  <div key={msg.id} style={{ maxWidth: '70%', padding: '0.75rem 1rem', borderRadius: '12px', alignSelf: msg.senderId === user?.uid ? 'flex-end' : 'flex-start', background: msg.senderId === user?.uid ? 'linear-gradient(135deg, #818cf8, #6366f1)' : 'white', color: msg.senderId === user?.uid ? 'white' : '#1f2937', boxShadow: msg.senderId !== user?.uid ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
                    <div style={{ fontSize: '0.9375rem', lineHeight: 1.4 }}>{msg.content}</div>
                    <div style={{ fontSize: '0.6875rem', opacity: 0.7, marginTop: '0.25rem', textAlign: 'right' }}>{new Date(msg.createdAt).toLocaleTimeString()}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem', borderTop: '1px solid #f3f4f6' }}>
                <input type="text" placeholder="Type a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #d1d5db', borderRadius: '999px', fontSize: '0.9375rem' }} />
                <button onClick={sendMsg} disabled={!newMessage.trim()} style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              <MessageSquare size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <h3 style={{ color: '#6b7280' }}>Select a conversation</h3>
              <p>Choose from the list or start a new message</p>
              <button className="btn btn-primary" onClick={openNewConvo} style={{ marginTop: '1rem' }}><Plus size={18} /> New Message</button>
            </div>
          )}
        </div>
      </div>

      {showNewConvo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowNewConvo(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: 420, padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquare size={20} /> Message Property Manager</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {admins.length > 0 ? admins.map(a => (
                <div key={a.uid} onClick={() => !creatingConvo && startConvo(a)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}><User size={18} /></div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{a.displayName || 'Property Manager'}</div>
                    <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>{a.email}</div>
                  </div>
                </div>
              )) : <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>No property managers found</p>}
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button className="btn btn-outline" onClick={() => setShowNewConvo(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApplicantSettingsPage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [statusAlerts, setStatusAlerts] = useState(true);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      loadPrefs();
    }
  }, [user]);

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
    setSaving(true);
    setSaved(false);
    try {
      await userService.update(user.uid, {
        displayName,
        phone,
        notifications: { email: emailNotifications, statusAlerts },
      } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error('Failed to save settings:', err); }
    finally { setSaving(false); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account preferences</p>
      </div>

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
          <input type="checkbox" checked={emailNotifications} onChange={e => setEmailNotifications(e.target.checked)} />
          <span>Email notifications</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={statusAlerts} onChange={e => setStatusAlerts(e.target.checked)} />
          <span>Application status alerts</span>
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
      <div className="page-header">
        <h1>Alerts</h1>
        <p>Stay up to date on your applications</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon"><Bell size={32} /></div>
        <h3 className="empty-state-title">No alerts</h3>
        <p className="empty-state-description">
          You'll be notified here when there are updates on your applications.
        </p>
      </div>
    </div>
  );
}

// ─── Listings / Browse Properties Page ───
export function ApplicantListingsPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    try {
      const [allProps, myApps] = await Promise.all([
        propertyService.getAll(),
        user ? applicationService.getByApplicant(user.uid) : Promise.resolve([]),
      ]);
      // Only show active/available listed properties
      setProperties(allProps.filter((p: any) => p.status === 'active' || p.status === 'available' || !p.status));
      setAppliedIds(new Set(myApps.map(a => a.propertyId)));
    } catch (err) { console.error('Error loading listings:', err); }
    finally { setLoading(false); }
  };

  const handleApply = async (propertyId: string) => {
    if (!user) return;
    setApplying(propertyId);
    try {
      await applicationService.create({
        propertyId,
        householdId: '',
        primaryApplicantId: user.uid,
        coApplicantIds: [],
        desiredMoveInDate: '',
        status: 'new',
        documents: [],
        notes: [],
        timeline: [{ status: 'new', date: new Date().toISOString(), note: 'Application submitted' }],
      });
      setAppliedIds(prev => new Set(prev).add(propertyId));
    } catch (err) { console.error('Error submitting application:', err); }
    finally { setApplying(null); }
  };

  const filtered = properties.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.address?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.state?.toLowerCase().includes(q)
    );
  });

  const fmt = (n: number | undefined) => n ? `$${n.toLocaleString()}` : '—';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Browse Properties</h1>
        <p>Find and apply to available rentals</p>
      </div>

      <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: 400 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          className="form-input"
          placeholder="Search by address, city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading properties...</div>
      ) : filtered.length > 0 ? (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {filtered.map(prop => {
            const already = appliedIds.has(prop.id);
            const photos: string[] = (prop as any).photos || [];
            return (
              <div key={prop.id} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 160, background: '#f3f4f6', overflow: 'hidden' }}>
                  {photos[0]
                    ? <img src={photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db' }}><Home size={40} /></div>}
                </div>
                <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>{fmt((prop as any).rent)}/mo</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={13} /> {prop.address}, {prop.city}, {prop.state}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                    {(prop as any).bedrooms != null && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Bed size={13} /> {(prop as any).bedrooms} bed</span>}
                    {(prop as any).bathrooms != null && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Bath size={13} /> {(prop as any).bathrooms} bath</span>}
                    {(prop as any).sqft != null && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Square size={13} /> {(prop as any).sqft} sqft</span>}
                  </div>
                  <div style={{ marginTop: 'auto' }}>
                    {already ? (
                      <button className="btn btn-sm" disabled style={{ width: '100%', background: '#d1fae5', color: '#059669', border: 'none' }}>
                        <CheckCircle size={14} /> Applied
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%' }}
                        disabled={applying === prop.id}
                        onClick={() => handleApply(prop.id)}
                      >
                        {applying === prop.id ? 'Submitting...' : 'Apply Now'}
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
          <p className="empty-state-description">
            {search ? 'Try a different search term.' : 'No properties are currently listed. Check back soon!'}
          </p>
        </div>
      )}
    </div>
  );
}
