import React, { useState } from 'react';
import {
  Layout,
  Code2,
  Cpu,
  Shield,
  Layers,
  Sparkles,
  CheckCircle2,
  FileText,
  MessageSquare,
  Key,
  Database,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DocumentItem } from '../types';

interface FrontendDashboardProps {
  documents: DocumentItem[];
  selectedDocIds: string[];
  activeConversationId: string | null;
  onNavigateToChat: () => void;
  onNavigateToDocs: () => void;
}

export const FrontendDashboard: React.FC<FrontendDashboardProps> = ({
  documents,
  selectedDocIds,
  activeConversationId,
  onNavigateToChat,
  onNavigateToDocs,
}) => {
  const { user, token } = useAuth();
  const [copiedToken, setCopiedToken] = useState(false);

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layout className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Frontend Client Tier</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  React 19 + Vite SPA Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Modern Reactive Single Page Application with Markdown Rendering & Citations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToChat}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Launch Chat Interface</span>
            </button>
            <button
              onClick={onNavigateToDocs}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Document Library ({documents.length})</span>
            </button>
          </div>
        </div>

        {/* Frontend Architecture Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Framework & Build</span>
            </div>
            <div className="text-sm font-semibold text-white">React 19 + Vite</div>
            <div className="text-[11px] text-slate-500 mt-0.5">TypeScript strict mode</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>UI Styling</span>
            </div>
            <div className="text-sm font-semibold text-teal-300">Tailwind CSS 4</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Lucide React Icons</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Active Scope</span>
            </div>
            <div className="text-sm font-semibold text-indigo-300">
              {selectedDocIds.length > 0 ? `${selectedDocIds.length} Docs Filtered` : 'All Documents'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Contextual retrieval</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Session State</span>
            </div>
            <div className="text-sm font-semibold text-cyan-300 truncate">
              {user ? user.name : 'Guest'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">{user?.email}</div>
          </div>
        </div>
      </div>

      {/* State & Component Tree Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Client State & Token Inspector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              Client-Side Authentication State
            </h3>
            {token && (
              <button
                onClick={copyToken}
                className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1"
              >
                {copiedToken ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : null}
                <span>{copiedToken ? 'Token Copied' : 'Copy JWT'}</span>
              </button>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-400">Authenticated User</div>
              <div className="font-semibold text-white">{user?.name} &lt;{user?.email}&gt;</div>
              <div className="font-mono text-slate-500 text-[11px]">User ID: {user?.id}</div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-400">Active Conversation ID</div>
              <div className="font-mono text-teal-300">
                {activeConversationId || 'None (New Conversation ready)'}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="text-slate-400">Local Storage Keys</div>
              <div className="font-mono text-indigo-300 text-[11px] space-y-0.5">
                <div>• rag_token: {token ? `${token.slice(0, 24)}...` : 'None'}</div>
                <div>• rag_user: {user ? JSON.stringify({ name: user.name, email: user.email }) : 'None'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Component Structure */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" />
            Frontend Component Hierarchy
          </h3>

          <div className="space-y-2 text-xs font-mono text-slate-300">
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-teal-400">&lt;Navbar /&gt;</span>
              <span className="text-slate-500 text-[11px]">3-Tier Switcher (Frontend, Backend, DB)</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-sky-400">&lt;ChatPanel /&gt;</span>
              <span className="text-slate-500 text-[11px]">Stream responses, citations & grounding</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-indigo-400">&lt;DocumentManager /&gt;</span>
              <span className="text-slate-500 text-[11px]">Drag & drop upload (PDF, DOCX, XLSX, TXT)</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-emerald-400">&lt;ConversationList /&gt;</span>
              <span className="text-slate-500 text-[11px]">Thread navigation & history deletion</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-amber-400">&lt;AuthModal /&gt;</span>
              <span className="text-slate-500 text-[11px]">Login & Registration gate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
