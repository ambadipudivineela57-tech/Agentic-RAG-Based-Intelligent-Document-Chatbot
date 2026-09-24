import React, { useEffect, useState } from 'react';
import {
  Bot,
  FileText,
  LogOut,
  Sparkles,
  User as UserIcon,
  Server,
  Database,
  Layout,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

interface NavbarProps {
  documentCount: number;
  activeTier: 'frontend' | 'backend' | 'database';
  setActiveTier: (tier: 'frontend' | 'backend' | 'database') => void;
  activeFrontendView: 'chat' | 'documents' | 'state';
  setActiveFrontendView: (view: 'chat' | 'documents' | 'state') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  documentCount,
  activeTier,
  setActiveTier,
  activeFrontendView,
  setActiveFrontendView,
}) => {
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
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Branding & Agent Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  Agentic RAG System
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-3 h-3" /> LangGraph + ChromaDB
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  {backendHealthy === true ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-emerald-400 font-medium">Node/FastAPI & Gemini Online</span>
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

          {/* User profile toggle for mobile */}
          {user && (
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={logout}
                title="Log out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Center: The 3 Primary Architecture Pillars */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800/90 shadow-inner">
          {/* 1. FRONTEND */}
          <button
            id="tier-frontend-btn"
            onClick={() => setActiveTier('frontend')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTier === 'frontend'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Frontend</span>
            {documentCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/80 text-emerald-300 font-mono">
                {documentCount} docs
              </span>
            )}
          </button>

          {/* 2. BACKEND */}
          <button
            id="tier-backend-btn"
            onClick={() => setActiveTier('backend')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTier === 'backend'
                ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Backend</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </button>

          {/* 3. DATABASE */}
          <button
            id="tier-database-btn"
            onClick={() => setActiveTier('database')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTier === 'database'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Database</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/80 text-indigo-300 font-mono">
              ChromaDB
            </span>
          </button>
        </div>

        {/* Right: User Profile & Logout */}
        <div className="hidden md:flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200">{user.name}</span>
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

      {/* Secondary Subnav bar when in Frontend */}
      {activeTier === 'frontend' && (
        <div className="max-w-7xl mx-auto mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] font-medium mr-1">Workspace:</span>
            <button
              onClick={() => setActiveFrontendView('chat')}
              className={`px-3 py-1 rounded-md transition font-medium flex items-center gap-1.5 ${
                activeFrontendView === 'chat'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Intelligent Chat</span>
            </button>
            <button
              onClick={() => setActiveFrontendView('documents')}
              className={`px-3 py-1 rounded-md transition font-medium flex items-center gap-1.5 ${
                activeFrontendView === 'documents'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Document Library ({documentCount})</span>
            </button>
            <button
              onClick={() => setActiveFrontendView('state')}
              className={`px-3 py-1 rounded-md transition font-medium flex items-center gap-1.5 ${
                activeFrontendView === 'state'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Client Architecture</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 hidden sm:block">
            Multi-tier decoupled RAG architecture
          </div>
        </div>
      )}
    </header>
  );
};
