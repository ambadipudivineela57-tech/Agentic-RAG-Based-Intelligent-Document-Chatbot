import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DocumentManager } from './components/DocumentManager';
import { ChatPanel } from './components/ChatPanel';
import { ConversationList } from './components/ConversationList';
import { AuthModal } from './components/AuthModal';
import { BackendDashboard } from './components/BackendDashboard';
import { DatabaseDashboard } from './components/DatabaseDashboard';
import { FrontendDashboard } from './components/FrontendDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DocumentItem, Conversation, ChatMessage } from './types';
import { documentApi, conversationApi, healthApi } from './api/client';
import { AlertTriangle, Key, ExternalLink, X } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, token, loading: authLoading } = useAuth();

  // The 3 Distinct Architecture Pillars
  const [activeTier, setActiveTier] = useState<'frontend' | 'backend' | 'database'>('frontend');
  const [activeFrontendView, setActiveFrontendView] = useState<'chat' | 'documents' | 'state'>('chat');

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [geminiMissing, setGeminiMissing] = useState(false);
  const [showKeyInstructions, setShowKeyInstructions] = useState(false);
  const [dismissBanner, setDismissBanner] = useState(false);

  // Check backend Gemini configuration
  useEffect(() => {
    healthApi.getHealth().then((res) => {
      if (res && res.geminiConfigured === false) {
        setGeminiMissing(true);
      }
    }).catch(() => {});
  }, []);

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
    setActiveTier('frontend');
    setActiveFrontendView('chat');
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await conversationApi.create('New Conversation');
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      setActiveTier('frontend');
      setActiveFrontendView('chat');
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

      {/* Main 3-Tier Navbar */}
      <Navbar
        documentCount={documents.length}
        activeTier={activeTier}
        setActiveTier={setActiveTier}
        activeFrontendView={activeFrontendView}
        setActiveFrontendView={setActiveFrontendView}
      />

      {/* Gemini API Key Warning Banner if missing on backend */}
      {geminiMissing && !dismissBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-xs sm:text-sm text-amber-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Gemini API Key Required:</strong> Your server needs a valid{' '}
                <code className="bg-amber-950/60 text-amber-300 px-1 py-0.5 rounded font-mono text-xs">
                  GEMINI_API_KEY
                </code>{' '}
                in its environment variables to generate AI answers.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowKeyInstructions(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium text-xs transition"
              >
                <Key className="w-3.5 h-3.5" />
                Setup Guide
              </button>
              <button
                onClick={() => setDismissBanner(true)}
                className="p-1 text-amber-400/70 hover:text-amber-300 transition"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Setup Guide Modal */}
      {showKeyInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowKeyInstructions(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">How to Set GEMINI_API_KEY</h3>
                <p className="text-xs text-slate-400">Required for document Q&A and embedding generation</p>
              </div>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-300">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <h4 className="font-semibold text-slate-200 mb-1 flex items-center justify-between">
                  <span>Step 1: Get a Free Gemini API Key</span>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-teal-400 hover:underline text-xs"
                  >
                    Google AI Studio <ExternalLink className="w-3 h-3" />
                  </a>
                </h4>
                <p className="text-slate-400 text-xs">
                  Create a key in Google AI Studio. It only takes 30 seconds and has generous free tier limits.
                </p>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <h4 className="font-semibold text-slate-200 mb-1">
                  Step 2: Add to Render (if deployed)
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-xs">
                  <li>Go to your <strong>Render Dashboard</strong>.</li>
                  <li>Click on your <strong>agentic-rag-chatbot</strong> service.</li>
                  <li>In the left sidebar, click <strong>Environment</strong>.</li>
                  <li>Click <strong>Add Environment Variable</strong>.</li>
                  <li>Key: <code className="text-teal-300 font-mono">GEMINI_API_KEY</code></li>
                  <li>Value: <em>(Paste your Google API key)</em></li>
                  <li>Click <strong>Save Changes</strong>. Render will restart with AI enabled!</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <h4 className="font-semibold text-slate-200 mb-1">
                  Local Environment (.env)
                </h4>
                <p className="text-xs text-slate-400 mb-1">
                  If running locally, add this line to your <code className="text-teal-300 font-mono">.env</code> file:
                </p>
                <div className="bg-slate-950 p-2 rounded font-mono text-xs text-teal-300 border border-slate-800 select-all">
                  GEMINI_API_KEY=AIzaSy...
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowKeyInstructions(false)}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area: Decoupled into Frontend, Backend, Database */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* ============================================================ */}
        {/* TIER 1: FRONTEND                                             */}
        {/* ============================================================ */}
        {activeTier === 'frontend' && (
          <>
            {activeFrontendView === 'documents' && (
              <DocumentManager
                documents={documents}
                selectedDocIds={selectedDocIds}
                onToggleDocSelection={handleToggleDocSelection}
                onSelectAllDocs={handleSelectAllDocs}
                onClearDocSelection={handleClearDocSelection}
                onRefreshDocs={fetchDocuments}
                loading={docsLoading}
              />
            )}

            {activeFrontendView === 'state' && (
              <FrontendDashboard
                documents={documents}
                selectedDocIds={selectedDocIds}
                activeConversationId={activeConversationId}
                onNavigateToChat={() => setActiveFrontendView('chat')}
                onNavigateToDocs={() => setActiveFrontendView('documents')}
              />
            )}

            {activeFrontendView === 'chat' && (
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
                    onNavigateToDocs={() => setActiveFrontendView('documents')}
                    activeConversationId={activeConversationId}
                    onNewConversation={handleNewConversation}
                    messages={messages}
                    setMessages={setMessages}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* TIER 2: BACKEND                                              */}
        {/* ============================================================ */}
        {activeTier === 'backend' && <BackendDashboard />}

        {/* ============================================================ */}
        {/* TIER 3: DATABASE                                             */}
        {/* ============================================================ */}
        {activeTier === 'database' && <DatabaseDashboard />}
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
