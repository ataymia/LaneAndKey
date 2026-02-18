import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts';
import {
  MessageSquare,
  Send,
  User,
  Wrench,
  Plus,
} from 'lucide-react';
import { conversationService, messageService, userService } from '../../lib/firebase';
import type { Conversation, Message, UserProfile } from '../../types';

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
  return (
    <div className="page">
      <div className="page-header">
        <h1>Maintenance</h1>
        <p>Submit and track maintenance requests</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">🔧</div>
        <h3 className="empty-state-title">No maintenance requests</h3>
        <p className="empty-state-description">
          Submit a request if you need something fixed.
        </p>
        <button className="btn btn-primary">Submit Request</button>
      </div>
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
  return (
    <div className="page">
      <div className="page-header">
        <h1>Alerts</h1>
        <p>View your notifications</p>
      </div>
      <div className="empty-state">
        <div className="empty-state-icon">🔔</div>
        <h3 className="empty-state-title">No alerts</h3>
        <p className="empty-state-description">
          You're all caught up! No new notifications.
        </p>
      </div>
    </div>
  );
}

export function TenantSettingsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account settings</p>
      </div>
      <div className="card" style={{ maxWidth: 600, padding: '2rem' }}>
        <h3>Coming Soon</h3>
        <p>Account settings will be available here.</p>
      </div>
    </div>
  );
}
