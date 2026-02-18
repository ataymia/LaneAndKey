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
} from 'lucide-react';
import { conversationService, messageService, userService } from '../../lib/firebase';
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

  useEffect(() => {
    if (user) {
      loadConversations();
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

  return (
    <div className="messages-page">
      <div className="messages-container">
        {/* Conversations List */}
        <div className="conversations-panel">
          <div className="panel-header">
            <div className="panel-header-row">
              <h2>Messages</h2>
              <button className="btn btn-sm btn-primary" onClick={openNewConversation} title="New Conversation">
                <Plus size={16} />
              </button>
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
                  onClick={() => selectConversation(conv)}
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
          </div>
        </div>

        {/* Messages Panel */}
        <div className="messages-panel">
          {selectedConversation ? (
            <>
              <div className="panel-header">
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
          ) : (
            <div className="no-selection">
              <MessageSquare size={48} />
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the list or start a new one</p>
              <button className="btn btn-primary" onClick={openNewConversation} style={{ marginTop: '1rem' }}>
                <Plus size={18} /> New Conversation
              </button>
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
