import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts';
import {
  MessageSquare,
  Search,
  Send,
  User,
  Wrench,
  Plus,
  X,
  Mail,
  Check,
  Archive,
  Trash2,
} from 'lucide-react';
import { conversationService, messageService, userService, contactSubmissionService } from '../../lib/firebase';
import type { ContactSubmission } from '../../lib/firebase/firestore';
import type { Conversation, Message, UserProfile } from '../../types';
import './Messages.css';

export function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New Conversation modal
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [creatingConvo, setCreatingConvo] = useState(false);

  // Map participant IDs -> display names
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});

  // Active tab: conversations or contact inquiries
  const [activeTab, setActiveTab] = useState<'conversations' | 'inquiries'>('conversations');
  const [inquiries, setInquiries] = useState<ContactSubmission[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<ContactSubmission | null>(null);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(true);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadInquiries();
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    if (!user) return;
    try {
      const data = await conversationService.getByParticipant(user.uid);
      setConversations(data);

      // Load participant names
      const allParticipantIds = new Set<string>();
      data.forEach(c => c.participantIds.forEach(id => allParticipantIds.add(id)));
      const names: Record<string, string> = {};
      for (const uid of allParticipantIds) {
        if (uid === user.uid) continue;
        try {
          const profile = await userService.get(uid);
          if (profile) names[uid] = profile.displayName || profile.email;
        } catch { /* skip */ }
      }
      setParticipantNames(names);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInquiries = async () => {
    try {
      setInquiryLoading(true);
      const data = await contactSubmissionService.getAll();
      setInquiries(data);
    } catch (error) {
      console.error('Error loading contact inquiries:', error);
    } finally {
      setInquiryLoading(false);
    }
  };

  const markInquiryRead = async (inquiry: ContactSubmission) => {
    try {
      await contactSubmissionService.update(inquiry.id, { read: true, status: 'read' });
      setInquiries(prev => prev.map(i => i.id === inquiry.id ? { ...i, read: true, status: 'read' } : i));
      if (selectedInquiry?.id === inquiry.id) {
        setSelectedInquiry({ ...inquiry, read: true, status: 'read' as const });
      }
    } catch (error) {
      console.error('Error marking inquiry read:', error);
    }
  };

  const archiveInquiry = async (id: string) => {
    try {
      await contactSubmissionService.update(id, { status: 'archived' });
      setInquiries(prev => prev.filter(i => i.id !== id));
      if (selectedInquiry?.id === id) setSelectedInquiry(null);
    } catch (error) {
      console.error('Error archiving inquiry:', error);
    }
  };

  const deleteInquiry = async (id: string) => {
    if (!window.confirm('Delete this inquiry permanently?')) return;
    try {
      await contactSubmissionService.delete(id);
      setInquiries(prev => prev.filter(i => i.id !== id));
      if (selectedInquiry?.id === id) setSelectedInquiry(null);
    } catch (error) {
      console.error('Error deleting inquiry:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const data = await messageService.getByConversation(conversationId);
      setMessages(data);
      // Mark unread messages as read
      for (const msg of data) {
        if (!msg.read && msg.senderId !== user?.uid) {
          messageService.markAsRead(msg.id).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const selectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    try {
      await messageService.create({
        conversationId: selectedConversation.id,
        senderId: user.uid,
        senderRole: 'admin',
        content: newMessage,
        read: false,
      });

      // Update conversation last message
      await conversationService.update(selectedConversation.id, {
        lastMessage: newMessage,
        lastMessageAt: new Date(),
      });

      await loadMessages(selectedConversation.id);
      setNewMessage('');
      // Refresh conversation list to update preview
      loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const openNewConversation = async () => {
    setShowNewConvo(true);
    try {
      const users = await userService.getAll();
      // Exclude current admin from list
      setAllUsers(users.filter(u => u.uid !== user?.uid));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const startConversation = async (targetUser: UserProfile) => {
    if (!user) return;
    // Check if conversation already exists between these two users
    const existing = conversations.find(c =>
      c.type === 'direct' &&
      c.participantIds.includes(targetUser.uid) &&
      c.participantIds.includes(user.uid)
    );
    if (existing) {
      setShowNewConvo(false);
      setUserSearch('');
      selectConversation(existing);
      return;
    }

    try {
      setCreatingConvo(true);
      const convoId = await conversationService.create({
        type: 'direct',
        participantIds: [user.uid, targetUser.uid],
        lastMessage: '',
        lastMessageAt: new Date(),
      });

      // Reload conversations and select the new one
      await loadConversations();
      const newConvo = await conversationService.get(convoId);
      if (newConvo) {
        setParticipantNames(prev => ({
          ...prev,
          [targetUser.uid]: targetUser.displayName || targetUser.email,
        }));
        selectConversation(newConvo);
      }
      setShowNewConvo(false);
      setUserSearch('');
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('Failed to create conversation');
    } finally {
      setCreatingConvo(false);
    }
  };

  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'maintenance': return <Wrench size={18} />;
      default: return <User size={18} />;
    }
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.type === 'maintenance') return 'Maintenance Request';
    const otherId = conv.participantIds.find(id => id !== user?.uid);
    if (otherId && participantNames[otherId]) return participantNames[otherId];
    return 'Direct Message';
  };

  const filteredConversations = searchQuery
    ? conversations.filter(c => {
        const name = getConversationName(c).toLowerCase();
        const preview = (c.lastMessage || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return name.includes(q) || preview.includes(q);
      })
    : conversations;

  const filteredUsers = userSearch
    ? allUsers.filter(u => {
        const q = userSearch.toLowerCase();
        return (
          u.displayName?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      })
    : allUsers;

  const unreadInquiries = inquiries.filter(i => !i.read && i.status !== 'archived').length;

  return (
    <div className="messages-page">
      <div className="messages-container">
        {/* Conversations List */}
        <div className={`conversations-panel${mobilePanelOpen ? ' show' : ''}`}>
          <div className="panel-header">
            <div className="panel-header-row" style={{ gap: '0.25rem' }}>
              <button
                className={`btn btn-sm ${activeTab === 'conversations' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setActiveTab('conversations'); setSelectedInquiry(null); }}
              >
                Messages
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'inquiries' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setActiveTab('inquiries'); setSelectedConversation(null); }}
                style={{ position: 'relative' }}
              >
                Inquiries
                {unreadInquiries > 0 && (
                  <span style={{
                    position: 'absolute', top: '-6px', right: '-6px',
                    background: '#ef4444', color: '#fff', borderRadius: '50%',
                    width: '18px', height: '18px', fontSize: '11px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{unreadInquiries}</span>
                )}
              </button>
              {activeTab === 'conversations' && (
                <button className="btn btn-sm btn-primary" onClick={openNewConversation} title="New Conversation" style={{ marginLeft: 'auto' }}>
                  <Plus size={16} />
                </button>
              )}
            </div>
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="conversations-list">
            {activeTab === 'conversations' ? (
              <>
                {loading ? (
                  <div className="loading-conversations">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="skeleton conversation-skeleton" />
                    ))}
                  </div>
                ) : filteredConversations.length > 0 ? (
                  filteredConversations.map(conv => (
                    <div
                      key={conv.id}
                      className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                      onClick={() => { selectConversation(conv); setSelectedInquiry(null); setMobilePanelOpen(false); }}
                    >
                      <div className={`conversation-icon ${conv.type}`}>
                        {getConversationIcon(conv.type)}
                      </div>
                      <div className="conversation-info">
                        <div className="conversation-name">
                          {getConversationName(conv)}
                        </div>
                        <div className="conversation-preview">
                          {conv.lastMessage || 'No messages yet'}
                        </div>
                      </div>
                      {conv.lastMessageAt && (
                        <div className="conversation-time">
                          {new Date(conv.lastMessageAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="no-conversations">
                    <MessageSquare size={32} />
                    <p>No conversations yet</p>
                    <button className="btn btn-sm btn-primary" onClick={openNewConversation} style={{ marginTop: '0.5rem' }}>
                      <Plus size={14} /> Start a Conversation
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {inquiryLoading ? (
                  <div className="loading-conversations">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="skeleton conversation-skeleton" />
                    ))}
                  </div>
                ) : inquiries.filter(i => i.status !== 'archived').length > 0 ? (
                  inquiries.filter(i => i.status !== 'archived').map(inq => (
                    <div
                      key={inq.id}
                      className={`conversation-item ${selectedInquiry?.id === inq.id ? 'active' : ''} ${!inq.read ? 'unread' : ''}`}
                      onClick={() => { setSelectedInquiry(inq); setSelectedConversation(null); setMobilePanelOpen(false); if (!inq.read) markInquiryRead(inq); }}
                    >
                      <div className="conversation-icon" style={{ background: !inq.read ? '#ef4444' : '#9BAAFF' }}>
                        <Mail size={18} />
                      </div>
                      <div className="conversation-info">
                        <div className="conversation-name" style={{ fontWeight: !inq.read ? 700 : 400 }}>
                          {inq.name}
                        </div>
                        <div className="conversation-preview">
                          {inq.interest === 'renting' ? '🏠 Renting' : inq.interest === 'buying' ? '🏡 Buying' : inq.interest === 'selling' ? '💰 Selling' : '💬 General'} — {inq.message?.slice(0, 50) || 'No message'}
                        </div>
                      </div>
                      <div className="conversation-time">
                        {(inq.createdAt instanceof Date ? inq.createdAt : new Date(inq.createdAt)).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-conversations">
                    <Mail size={32} />
                    <p>No contact inquiries</p>
                    <p style={{ fontSize: '0.8rem', color: '#999' }}>Submissions from the contact page will appear here</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Messages Panel */}
        <div className="messages-panel">
          {selectedConversation ? (
            <>
              <div className="panel-header">
                <button className="btn btn-sm btn-outline mobile-back-btn" onClick={() => { setSelectedConversation(null); setMobilePanelOpen(true); }}>
                  ← Back
                </button>
                <div className="selected-conversation">
                  <div className={`conversation-icon ${selectedConversation.type}`}>
                    {getConversationIcon(selectedConversation.type)}
                  </div>
                  <div>
                    <h3>{getConversationName(selectedConversation)}</h3>
                  </div>
                </div>
              </div>
              <div className="messages-list">
                {messages.length === 0 ? (
                  <div className="no-messages-hint">
                    <p>No messages yet. Send the first message below!</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`message ${msg.senderId === user?.uid ? 'sent' : 'received'}`}
                    >
                      <div className="message-content">{msg.content}</div>
                      <div className="message-time">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="message-input">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} disabled={!newMessage.trim()}>
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : selectedInquiry ? (
            <div className="inquiry-detail" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              <button className="btn btn-sm btn-outline mobile-back-btn" onClick={() => { setSelectedInquiry(null); setMobilePanelOpen(true); }} style={{ marginBottom: '0.75rem' }}>
                ← Back
              </button>
              <div className="panel-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{selectedInquiry.name}</h3>
                  <p style={{ margin: '0.25rem 0', color: '#666', fontSize: '0.9rem' }}>
                    {selectedInquiry.email} {selectedInquiry.phone ? `• ${selectedInquiry.phone}` : ''}
                  </p>
                  <span className={`badge badge-${selectedInquiry.interest === 'renting' ? 'primary' : selectedInquiry.interest === 'buying' ? 'success' : selectedInquiry.interest === 'selling' ? 'warning' : 'info'}`}>
                    {selectedInquiry.interest === 'renting' ? '🏠 Renting' : selectedInquiry.interest === 'buying' ? '🏡 Buying' : selectedInquiry.interest === 'selling' ? '💰 Selling' : '💬 General Inquiry'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!selectedInquiry.read && (
                    <button className="btn btn-sm btn-outline" onClick={() => markInquiryRead(selectedInquiry)} title="Mark as read">
                      <Check size={14} />
                    </button>
                  )}
                  <button className="btn btn-sm btn-outline" onClick={() => archiveInquiry(selectedInquiry.id)} title="Archive">
                    <Archive size={14} />
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => deleteInquiry(selectedInquiry.id)} title="Delete" style={{ color: '#ef4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '1.25rem', marginTop: '1rem' }}>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedInquiry.message}</p>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#999' }}>
                Submitted {(selectedInquiry.createdAt instanceof Date ? selectedInquiry.createdAt : new Date(selectedInquiry.createdAt)).toLocaleString()}
              </p>
              <div style={{ marginTop: '1.5rem' }}>
                <a href={`mailto:${selectedInquiry.email}?subject=Re: Your inquiry to Lane %26 Key Properties`} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={16} /> Reply via Email
                </a>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <MessageSquare size={48} />
              <h3>{activeTab === 'inquiries' ? 'Select an inquiry' : 'Select a conversation'}</h3>
              <p>{activeTab === 'inquiries' ? 'Choose a contact inquiry from the list to view details' : 'Choose a conversation from the list or start a new one'}</p>
              <button className="btn btn-outline mobile-back-btn" onClick={() => setMobilePanelOpen(true)} style={{ marginTop: '0.5rem' }}>
                ← Show List
              </button>
              {activeTab === 'conversations' && (
                <button className="btn btn-primary" onClick={openNewConversation} style={{ marginTop: '1rem' }}>
                  <Plus size={18} /> New Conversation
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConvo && (
        <div className="modal-overlay" onClick={() => setShowNewConvo(false)}>
          <div className="modal new-convo-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><MessageSquare size={20} /> New Conversation</h2>
              <button className="modal-close" onClick={() => { setShowNewConvo(false); setUserSearch(''); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="search-box" style={{ marginBottom: '1rem' }}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search users by name, email, or role..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="user-picker-list">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(u => (
                    <div
                      key={u.uid}
                      className="user-picker-item"
                      onClick={() => !creatingConvo && startConversation(u)}
                    >
                      <div className="user-picker-avatar">
                        <User size={18} />
                      </div>
                      <div className="user-picker-info">
                        <div className="user-picker-name">{u.displayName || 'No Name'}</div>
                        <div className="user-picker-email">{u.email}</div>
                      </div>
                      <span className={`badge badge-${u.role === 'admin' ? 'primary' : u.role === 'tenant' ? 'success' : 'info'}`}>
                        {u.role}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="no-users-found">
                    <p>No users found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
