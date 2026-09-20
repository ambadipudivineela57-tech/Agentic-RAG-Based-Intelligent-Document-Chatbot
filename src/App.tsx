import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DocumentManager } from './components/DocumentManager';
import { ChatPanel } from './components/ChatPanel';
import { ConversationList } from './components/ConversationList';
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DocumentItem, Conversation, ChatMessage } from './types';
import { documentApi, conversationApi } from './api/client';

const MainApp: React.FC = () => {
  const { user, token, loading: authLoading } = useAuth();
  const [activeView, setActiveView] = useState<'chat' | 'documents'>('chat');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Fetch user documents
  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    setDocsLoading(true);
    try {
      const data = await documentApi.list();
      setDocuments(data);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setDocsLoading(false);
    }
  }, [token]);

  // Fetch user conversations
  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await conversationApi.list();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [token]);

  // Load conversation details when activeConversationId changes
  const loadConversationMessages = useCallback(async (convId: string) => {
    try {
      const detail = await conversationApi.get(convId);
      const parsedMessages: ChatMessage[] = detail.messages.map((m) => {
        let parsedSources = undefined;
        if (m.sources) {
          try {
            parsedSources = JSON.parse(m.sources);
          } catch {
            parsedSources = undefined;
          }
        }
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          sources: parsedSources,
          created_at: m.created_at,
        };
      });
      setMessages(parsedMessages);
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    }
  }, []);

  useEffect(() => {
    if (token && user) {
      fetchDocuments();
      fetchConversations();
    } else {
      setDocuments([]);
      setConversations([]);
      setMessages([]);
      setActiveConversationId(null);
    }
  }, [token, user, fetchDocuments, fetchConversations]);

  // Auto-poll if any document is in PROCESSING status
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'PROCESSING' || d.status === 'UPLOADED');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 3000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const handleToggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectAllDocs = () => {
    setSelectedDocIds(documents.map((d) => d.id));
  };

  const handleClearDocSelection = () => {
    setSelectedDocIds([]);
  };

  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    loadConversationMessages(convId);
    setActiveView('chat');
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await conversationApi.create('New Conversation');
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      setActiveView('chat');
    } catch (err) {
      console.error('Failed to create new conversation:', err);
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      await conversationApi.delete(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30">
      {/* Auth Gate */}
      {!authLoading && !user && <AuthModal />}

      {/* Main Navbar */}
      <Navbar
        documentCount={documents.length}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeView === 'documents' ? (
          <DocumentManager
            documents={documents}
            selectedDocIds={selectedDocIds}
            onToggleDocSelection={handleToggleDocSelection}
            onSelectAllDocs={handleSelectAllDocs}
            onClearDocSelection={handleClearDocSelection}
            onRefreshDocs={fetchDocuments}
            loading={docsLoading}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Left Sidebar: Conversation Threads */}
            <div className="hidden lg:block lg:col-span-1">
              <ConversationList
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
                onDeleteConversation={handleDeleteConversation}
              />
            </div>

            {/* Main Chat Panel */}
            <div className="lg:col-span-3">
              <ChatPanel
                documents={documents}
                selectedDocIds={selectedDocIds}
                onClearDocFilter={handleClearDocSelection}
                onNavigateToDocs={() => setActiveView('documents')}
                activeConversationId={activeConversationId}
                onNewConversation={handleNewConversation}
                messages={messages}
                setMessages={setMessages}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
