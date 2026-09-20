import React, { useEffect, useState } from 'react';
import { Bot, FileText, LogOut, Sparkles, User as UserIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

interface NavbarProps {
  documentCount: number;
  activeView: 'chat' | 'documents';
  setActiveView: (view: 'chat' | 'documents') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ documentCount, activeView, setActiveView }) => {
  const { user, logout } = useAuth();
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await axios.get('/api/health');
        setBackendHealthy(res.data?.status === 'ok');
      } catch {
        setBackendHealthy(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header id="main-header" className="bg-slate-900 border-b border-slate-800 text-slate-100 px-4 sm:px-6 py-3 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Branding & Agent Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white">
                Agentic RAG Assistant
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-3 h-3" /> LangGraph Agent
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                {backendHealthy === true ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-emerald-400 font-medium">FastAPI & Gemini Online</span>
                  </>
                ) : backendHealthy === false ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                    <span className="text-rose-400">Backend Disconnected</span>
                  </>
                ) : (
                  <span className="text-slate-500">Checking system...</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Center: View Switcher Tabs */}
        <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <button
            id="view-chat-tab-btn"
            onClick={() => setActiveView('chat')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${
              activeView === 'chat'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Chat</span>
          </button>
          <button
            id="view-docs-tab-btn"
            onClick={() => setActiveView('documents')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${
              activeView === 'documents'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documents</span>
            <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-slate-900/60 text-slate-300 font-mono">
              {documentCount}
            </span>
          </button>
        </div>

        {/* Right: User Profile & Logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-medium text-slate-200">{user.name}</span>
                <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{user.email}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <UserIcon className="w-4 h-4" />
              </div>
              <button
                id="navbar-logout-btn"
                onClick={logout}
                title="Log out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
