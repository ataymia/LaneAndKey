import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts';
import {
  MessageSquare,
  Send,
  User,
  Wrench,
  Plus,
} from 'lucide-react';
import { conversationService, messageService, userService, maintenanceService, leaseService } from '../../lib/firebase';
import { createAdminAlert } from '../../lib/firebase/adminAlerts';
import type {
  Conversation,
  Message,
  UserProfile,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceTicket,
} from '../../types';

// Placeholder pages for Tenant portal
export function TenantLeasePage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>My Lease</h1>
        <p>View your lease details and documents</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">📄</div>
        <h3 className="empty-state-title">No active lease</h3>
        <p className="empty-state-description">
          Your lease details will appear here once you have an active lease.
        </p>
      </div>
    </div>
  );
}

export function TenantMaintenancePage() {
  const { userProfile } = useAuth();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: 'other' as MaintenanceCategory,
    priority: 'medium' as MaintenancePriority,
    description: '',
  });

  useEffect(() => {
    const loadTickets = async () => {
      if (!userProfile) return;
      try {
        setLoading(true);
        const data = await maintenanceService.getByTenant(userProfile.uid);
        setTickets(data);
      } catch (error) {
        console.error('Error loading tenant maintenance tickets:', error);
        setMessage('Failed to load maintenance requests.');
      } finally {
        setLoading(false);
      }
    };

    loadTickets();
  }, [userProfile]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userProfile || !form.description.trim()) return;

    try {
      setSubmitting(true);
      setMessage(null);

      let propertyId = userProfile.currentPropertyId;
      if (!propertyId && userProfile.currentLeaseId) {
        const lease = await leaseService.get(userProfile.currentLeaseId);
        propertyId = lease?.propertyId;
      }

      if (!propertyId) {
        setMessage('No lease assigned. Contact management before submitting requests.');
        return;
      }

      await maintenanceService.create({
        propertyId,
        tenantId: userProfile.uid,
        category: form.category,
        priority: form.priority,
        description: form.description.trim(),
        attachments: [],
        status: 'new',
        comments: [],
      });

      createAdminAlert({
        type: 'maintenance',
        title: 'New Maintenance Request',
        message: `Tenant ${userProfile.displayName || userProfile.uid} submitted a ${form.priority} priority ${form.category} maintenance request.`,
        relatedType: 'maintenance',
      });

      const updated = await maintenanceService.getByTenant(userProfile.uid);
      setTickets(updated);
      setForm({ category: 'other', priority: 'medium', description: '' });
      setMessage('Maintenance request submitted successfully.');
    } catch (error) {
      console.error('Error submitting maintenance request:', error);
      setMessage('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Maintenance</h1>
        <p>Submit and track maintenance requests</p>
      </div>

      <form className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem', marginBottom: '1rem' }} onSubmit={handleSubmit}>
        <h3>Submit Request</h3>
        <label>
          Category
          <select value={form.category} onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value as MaintenanceCategory }))}>
            <option value="plumbing">Plumbing</option>
            <option value="electrical">Electrical</option>
            <option value="hvac">HVAC</option>
            <option value="appliance">Appliance</option>
            <option value="structural">Structural</option>
            <option value="pest">Pest</option>
            <option value="landscaping">Landscaping</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Priority
          <select value={form.priority} onChange={(event) => setForm((previous) => ({ ...previous, priority: event.target.value as MaintenancePriority }))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="emergency">Emergency</option>
          </select>
        </label>
        <label>
          Description
          <textarea
            rows={4}
            value={form.description}
            onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
            placeholder="Describe the issue in detail"
            required
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
        {message && <p>{message}</p>}
      </form>

      {loading ? (
        <div className="empty-state"><p>Loading maintenance requests...</p></div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔧</div>
          <h3 className="empty-state-title">No maintenance requests</h3>
          <p className="empty-state-description">Submit a request above if you need something fixed.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '1rem' }}>
          <h3>Open & Recent Requests</h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {tickets.map((ticket) => (
              <div key={ticket.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem' }}>
                <div style={{ fontWeight: 600 }}>{ticket.category} · {ticket.priority}</div>
                <div style={{ fontSize: '0.9rem', color: '#4b5563' }}>{ticket.description}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Status: {ticket.status.replace('_', ' ')} · Created {new Date(ticket.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TenantDocumentsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Documents</h1>
        <p>Upload and view your documents</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">📁</div>
        <h3 className="empty-state-title">No documents</h3>
        <p className="empty-state-description">
          Your documents will appear here.
        </p>
        <button className="btn btn-primary">Upload Document</button>
      </div>
    </div>
  );
}

export function TenantMessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New conversation
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [creatingConvo, setCreatingConvo] = useState(false);

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    if (!user) return;
    try {
      const data = await conversationService.getByParticipant(user.uid);
      setConversations(data);
      const ids = new Set<string>();
      data.forEach(c => c.participantIds.forEach(id => ids.add(id)));
      const names: Record<string, string> = {};
      for (const uid of ids) {
        if (uid === user.uid) continue;
        try {
          const p = await userService.get(uid);
          if (p) names[uid] = p.displayName || p.email;
        } catch { /* skip */ }
      }
      setParticipantNames(names);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (id: string) => {
    try {
      const data = await messageService.getByConversation(id);
      setMessages(data);
      for (const msg of data) {
        if (!msg.read && msg.senderId !== user?.uid) {
          messageService.markAsRead(msg.id).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const selectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    loadMessages(conv.id);
  };

  const sendMsg = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;
    try {
      await messageService.create({
        conversationId: selectedConversation.id,
        senderId: user.uid,
        senderRole: 'tenant',
        content: newMessage,
        read: false,
      });
      await conversationService.update(selectedConversation.id, {
        lastMessage: newMessage,
        lastMessageAt: new Date(),
      });
      await loadMessages(selectedConversation.id);
      setNewMessage('');
      loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const openNewConvo = async () => {
    setShowNewConvo(true);
    try {
      const data = await userService.getByRole('admin');
      setAdmins(data);
    } catch { /* skip */ }
  };

  const startConvo = async (admin: UserProfile) => {
    if (!user) return;
    const existing = conversations.find(c =>
      c.type === 'direct' && c.participantIds.includes(admin.uid) && c.participantIds.includes(user.uid)
    );
    if (existing) {
      setShowNewConvo(false);
      selectConversation(existing);
      return;
    }
    try {
      setCreatingConvo(true);
      const id = await conversationService.create({
        type: 'direct',
        participantIds: [user.uid, admin.uid],
        lastMessage: '',
        lastMessageAt: new Date(),
      });
      await loadConversations();
      const newConvo = await conversationService.get(id);
      if (newConvo) {
        setParticipantNames(prev => ({ ...prev, [admin.uid]: admin.displayName || admin.email }));
        selectConversation(newConvo);
      }
      setShowNewConvo(false);
    } catch (error) {
      console.error('Error creating conversation:', error);
    } finally {
      setCreatingConvo(false);
    }
  };

  const getConvoName = (conv: Conversation) => {
    if (conv.type === 'maintenance') return 'Maintenance Request';
    const otherId = conv.participantIds.find(id => id !== user?.uid);
    if (otherId && participantNames[otherId]) return participantNames[otherId];
    return 'Property Manager';
  };

  const getConvoIcon = (type: string) => {
    switch (type) {
      case 'maintenance': return <Wrench size={18} />;
      default: return <User size={18} />;
    }
  };

  return (
    <div className="page" style={{ height: 'calc(100vh - 8rem)' }}>
      <div style={{ display: 'flex', height: '100%', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {/* Conversation List */}
        <div style={{ width: 280, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Messages</h2>
            <button className="btn btn-sm btn-primary" onClick={openNewConvo}><Plus size={16} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
            ) : conversations.length > 0 ? (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                    cursor: 'pointer', borderBottom: '1px solid #f9fafb',
                    background: selectedConversation?.id === conv.id ? '#eef2ff' : 'transparent'
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', flexShrink: 0 }}>
                    {getConvoIcon(conv.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{getConvoName(conv)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.lastMessage || 'No messages yet'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                <MessageSquare size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <p>No conversations</p>
                <button className="btn btn-sm btn-primary" onClick={openNewConvo} style={{ marginTop: '0.5rem' }}>
                  <Plus size={14} /> New Message
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedConversation ? (
            <>
              <div style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                  {getConvoIcon(selectedConversation.type)}
                </div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{getConvoName(selectedConversation)}</h3>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#f9fafb' }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', margin: 'auto' }}>Send the first message below!</div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        maxWidth: '70%',
                        padding: '0.75rem 1rem',
                        borderRadius: '12px',
                        alignSelf: msg.senderId === user?.uid ? 'flex-end' : 'flex-start',
                        background: msg.senderId === user?.uid ? 'linear-gradient(135deg, #818cf8, #6366f1)' : 'white',
                        color: msg.senderId === user?.uid ? 'white' : '#1f2937',
                        boxShadow: msg.senderId !== user?.uid ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      }}
                    >
                      <div style={{ fontSize: '0.9375rem', lineHeight: 1.4 }}>{msg.content}</div>
                      <div style={{ fontSize: '0.6875rem', opacity: 0.7, marginTop: '0.25rem', textAlign: 'right' }}>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem', borderTop: '1px solid #f3f4f6' }}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMsg()}
                  style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #d1d5db', borderRadius: '999px', fontSize: '0.9375rem' }}
                />
                <button onClick={sendMsg} disabled={!newMessage.trim()}
                  style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              <MessageSquare size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <h3 style={{ color: '#6b7280' }}>Select a conversation</h3>
              <p>Choose from the list or start a new message</p>
              <button className="btn btn-primary" onClick={openNewConvo} style={{ marginTop: '1rem' }}>
                <Plus size={18} /> New Message
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConvo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowNewConvo(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: 420, padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={20} /> Message Property Manager
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {admins.length > 0 ? admins.map(a => (
                <div key={a.uid} onClick={() => !creatingConvo && startConvo(a)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                    <User size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{a.displayName || 'Property Manager'}</div>
                    <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>{a.email}</div>
                  </div>
                </div>
              )) : (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>No property managers found</p>
              )}
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

export function TenantAlertsPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<import('../../types').Alert[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { alertService } = await import('../../lib/firebase/firestore');
        const data = await alertService.getByUser(userProfile.uid);
        if (!cancelled) setAlerts(data);
      } catch (err) {
        console.error('Failed to load alerts:', err);
        if (!cancelled) setError('Failed to load alerts. Please refresh.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userProfile?.uid]);

  const handleMarkRead = async (alertId: string) => {
    try {
      const { alertService } = await import('../../lib/firebase/firestore');
      await alertService.markAsRead(alertId);
      setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, read: true } : a));
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const handleArchive = async (alertId: string) => {
    try {
      const { alertService } = await import('../../lib/firebase/firestore');
      await alertService.archive(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error('Failed to archive alert:', err);
    }
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  if (loading) {
    return (
      <div className="page">
        <div className="page-header"><h1>Alerts</h1><p>Loading notifications...</p></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Alerts {unreadCount > 0 && <span style={{ fontSize: '0.75em', background: 'var(--danger-color, #ef4444)', color: '#fff', borderRadius: '12px', padding: '2px 8px', marginLeft: '8px' }}>{unreadCount}</span>}</h1>
        <p>View your notifications</p>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '8px', border: 'none', background: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <h3 className="empty-state-title">No alerts</h3>
          <p className="empty-state-description">
            You're all caught up! No new notifications.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                border: `1px solid ${alert.read ? 'var(--border-color, #e2e8f0)' : 'var(--primary-color, #3b82f6)'}`,
                background: alert.read ? 'var(--card-bg, #fff)' : 'rgba(59,130,246,0.04)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
              }}
            >
              <div style={{ flex: '0 0 8px', marginTop: '6px' }}>
                {!alert.read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color, #3b82f6)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: alert.read ? 400 : 600, marginBottom: '4px' }}>{alert.title}</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)' }}>{alert.message}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', marginTop: '6px' }}>
                  {new Date(alert.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                {!alert.read && (
                  <button
                    onClick={() => handleMarkRead(alert.id)}
                    style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--card-bg, #fff)', cursor: 'pointer' }}
                  >
                    Mark Read
                  </button>
                )}
                <button
                  onClick={() => handleArchive(alert.id)}
                  style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--card-bg, #fff)', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TenantSettingsPage() {
  const { userProfile, updateProfile, changePassword } = useAuth();
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [preferredContactMethod, setPreferredContactMethod] = useState<'email' | 'phone' | 'sms'>(
    userProfile?.preferredContactMethod || 'email'
  );
  const [emergencyName, setEmergencyName] = useState(userProfile?.emergencyContact?.name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(userProfile?.emergencyContact?.phone || '');
  const [emergencyRelationship, setEmergencyRelationship] = useState(userProfile?.emergencyContact?.relationship || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Security question
  const [securityQuestion, setSecurityQuestion] = useState(userProfile?.securityQuestion || '');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    setPhone(userProfile?.phone || '');
    setPreferredContactMethod(userProfile?.preferredContactMethod || 'email');
    setEmergencyName(userProfile?.emergencyContact?.name || '');
    setEmergencyPhone(userProfile?.emergencyContact?.phone || '');
    setEmergencyRelationship(userProfile?.emergencyContact?.relationship || '');
    setSecurityQuestion(userProfile?.securityQuestion || '');
  }, [userProfile]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      await updateProfile({
        phone,
        preferredContactMethod,
        emergencyContact: {
          name: emergencyName,
          phone: emergencyPhone,
          relationship: emergencyRelationship,
        },
      } as Partial<UserProfile>);
      setMessage('Settings saved.');
    } catch (error) {
      console.error('Failed to save tenant settings:', error);
      setMessage('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const SECURITY_QUESTIONS = [
    'What was the name of your first pet?',
    'What city were you born in?',
    'What is your mother\'s maiden name?',
    'What was the name of your first school?',
    'What is your favorite movie?',
    'What street did you grow up on?',
  ];

  const handleSaveSecurity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!securityQuestion || !securityAnswer.trim()) {
      setSecurityMessage('Please select a question and provide an answer.');
      return;
    }
    try {
      setSavingSecurity(true);
      setSecurityMessage(null);
      await updateProfile({
        securityQuestion,
        securityAnswer: securityAnswer.toLowerCase().trim(),
      } as Partial<UserProfile>);
      setSecurityAnswer('');
      setSecurityMessage('Security question saved.');
    } catch (error) {
      console.error('Failed to save security question:', error);
      setSecurityMessage('Failed to save. Please try again.');
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordMessage('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage('New passwords do not match.');
      return;
    }
    try {
      setChangingPassword(true);
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordMessage('Password changed successfully.');
    } catch (error: any) {
      if (error?.code === 'auth/wrong-password' || error?.message?.includes('auth/wrong-password') || error?.message?.includes('invalid-credential')) {
        setPasswordMessage('Current password is incorrect.');
      } else if (error?.message?.includes('auth/weak-password')) {
        setPasswordMessage('New password is too weak. Use at least 8 characters with letters and numbers.');
      } else {
        setPasswordMessage('Failed to change password. Please try again.');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Update your contact details and account security</p>
      </div>

      {/* Contact Settings */}
      <form className="card" style={{ maxWidth: 600, padding: '2rem', display: 'grid', gap: '1rem', marginBottom: '1.5rem' }} onSubmit={handleSave}>
        <h3 style={{ margin: 0 }}>Contact Information</h3>
        <label>
          Phone Number
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(555) 000-0000" />
        </label>
        <label>
          Preferred Contact Method
          <select value={preferredContactMethod} onChange={(event) => setPreferredContactMethod(event.target.value as 'email' | 'phone' | 'sms')}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="sms">SMS</option>
          </select>
        </label>
        <label>
          Emergency Contact Name
          <input value={emergencyName} onChange={(event) => setEmergencyName(event.target.value)} />
        </label>
        <label>
          Emergency Contact Phone
          <input value={emergencyPhone} onChange={(event) => setEmergencyPhone(event.target.value)} />
        </label>
        <label>
          Relationship
          <input value={emergencyRelationship} onChange={(event) => setEmergencyRelationship(event.target.value)} />
        </label>
        {message && <p style={{ color: message.includes('Failed') ? '#dc2626' : '#16a34a', margin: 0, fontSize: '0.875rem' }}>{message}</p>}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Contact Info'}
        </button>
      </form>

      {/* Security Question */}
      <form className="card" style={{ maxWidth: 600, padding: '2rem', display: 'grid', gap: '1rem', marginBottom: '1.5rem' }} onSubmit={handleSaveSecurity}>
        <h3 style={{ margin: 0 }}>Security Question</h3>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {userProfile?.securityQuestion
            ? 'Your security question is set. You can change it below.'
            : 'Set up a security question to help recover your account if you forget your password.'}
        </p>
        <label>
          Select a Question
          <select value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)}>
            <option value="">Choose a security question...</option>
            {SECURITY_QUESTIONS.map(q => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </label>
        <label>
          Your Answer
          <input
            type="text"
            value={securityAnswer}
            onChange={e => setSecurityAnswer(e.target.value)}
            placeholder="Type your answer"
          />
        </label>
        {securityMessage && <p style={{ color: securityMessage.includes('Failed') ? '#dc2626' : '#16a34a', margin: 0, fontSize: '0.875rem' }}>{securityMessage}</p>}
        <button className="btn btn-primary" type="submit" disabled={savingSecurity}>
          {savingSecurity ? 'Saving...' : 'Save Security Question'}
        </button>
      </form>

      {/* Change Password */}
      <form className="card" style={{ maxWidth: 600, padding: '2rem', display: 'grid', gap: '1rem' }} onSubmit={handleChangePassword}>
        <h3 style={{ margin: 0 }}>Change Password</h3>
        <label>
          Current Password
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
        </label>
        <label>
          New Password
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" required />
        </label>
        <label>
          Confirm New Password
          <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required />
        </label>
        {passwordMessage && <p style={{ color: passwordMessage.includes('success') ? '#16a34a' : '#dc2626', margin: 0, fontSize: '0.875rem' }}>{passwordMessage}</p>}
        <button className="btn btn-primary" type="submit" disabled={changingPassword}>
          {changingPassword ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
