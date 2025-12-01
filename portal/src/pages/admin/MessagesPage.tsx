import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts';
import {
  MessageSquare,
  Search,
  Send,
  User,
  Wrench,
} from 'lucide-react';
import { conversationService, messageService } from '../../lib/firebase';
import type { Conversation, Message } from '../../types';
import './Messages.css';

export function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;
    try {
      const data = await conversationService.getByParticipant(user.uid);
      setConversations(data);
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

      // Reload messages
      await loadMessages(selectedConversation.id);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'maintenance': return <Wrench size={18} />;
      default: return <User size={18} />;
    }
  };

  return (
    <div className="messages-page">
      <div className="messages-container">
        {/* Conversations List */}
        <div className="conversations-panel">
          <div className="panel-header">
            <h2>Messages</h2>
            <div className="search-box">
              <Search size={16} />
              <input type="text" placeholder="Search..." />
            </div>
          </div>
          <div className="conversations-list">
            {loading ? (
              <div className="loading-conversations">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton conversation-skeleton" />
                ))}
              </div>
            ) : conversations.length > 0 ? (
              conversations.map(conv => (
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
                      {conv.type === 'maintenance' ? 'Maintenance Request' : 'Direct Message'}
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
                    <h3>
                      {selectedConversation.type === 'maintenance' 
                        ? 'Maintenance Request' 
                        : 'Direct Message'}
                    </h3>
                  </div>
                </div>
              </div>
              <div className="messages-list">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`message ${msg.senderId === user?.uid ? 'sent' : 'received'}`}
                  >
                    <div className="message-content">{msg.content}</div>
                    <div className="message-time">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
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
              <p>Choose a conversation from the list to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
