import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User as UserIcon,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Layers,
  CheckCircle2,
  FileText,
  Filter,
  ArrowRight,
  AlertCircle,
  Plus,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { ChatMessage, DocumentItem } from '../types';
import { chatApi } from '../api/client';

interface ChatPanelProps {
  documents: DocumentItem[];
  selectedDocIds: string[];
  onClearDocFilter: () => void;
  onNavigateToDocs: () => void;
  activeConversationId: string | null;
  onNewConversation: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  documents,
  selectedDocIds,
  onClearDocFilter,
  onNavigateToDocs,
  activeConversationId,
  onNewConversation,
  messages,
  setMessages,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentStep, setAgentStep] = useState<string>('idle');
  const [expandedSources, setExpandedSources] = useState<{ [msgIndex: number]: boolean }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing, agentStep]);

  const toggleSourceExpansion = (idx: number) => {
    setExpandedSources((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleSendMessage = async (queryText?: string) => {
    const text = (queryText || inputQuery).trim();
    if (!text || isProcessing) return;

    setInputQuery('');
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    // Simulate agent steps for responsive feedback
    setAgentStep('Analyzing query & intent...');
    const timer1 = setTimeout(() => setAgentStep('Retrieving semantic vectors from ChromaDB...'), 600);
    const timer2 = setTimeout(() => setAgentStep('Evaluating context relevance & coverage...'), 1400);
    const timer3 = setTimeout(() => setAgentStep('Synthesizing grounded response with Gemini...'), 2200);

    try {
      const response = await chatApi.sendMessage(
        text,
        selectedDocIds.length > 0 ? selectedDocIds : undefined,
        activeConversationId
      );

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.answer,
        sources: response.sources || [],
        metadata: response.metadata || {},
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Error generating answer: ${err.response?.data?.detail || err.message || 'Server error'}. Please verify your documents and Gemini API key.`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
      setAgentStep('idle');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const activeDocs = selectedDocIds.length > 0
    ? documents.filter((d) => selectedDocIds.includes(d.id))
    : documents;

  const starterQuestions = [
    "Summarize Project Titan's technical benchmarks and cryogenic specs",
    "Which department had the largest Q1 budget and what was their status?",
    "What are the compliance and tenant isolation settings in cluster config?",
    "Compare spend versus budget allocated across AI Research and Engineering",
  ];

  return (
    <div id="chat-panel-container" className="flex flex-col h-[calc(100vh-8.5rem)] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Banner: Active Filter & Conversation controls */}
      <div className="bg-slate-800/80 border-b border-slate-700/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-slate-400">Search Scope:</span>
          {selectedDocIds.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-medium border border-teal-500/30">
              <span>{selectedDocIds.length} Document(s) filtered</span>
              <button
                onClick={onClearDocFilter}
                className="hover:text-white font-bold text-teal-400 ml-1"
                title="Clear filter and search all documents"
              >
                ×
              </button>
            </span>
          ) : (
            <span className="text-slate-200 font-medium">
              All Indexed Documents ({documents.length})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {documents.length === 0 && (
            <button
              onClick={onNavigateToDocs}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 underline font-medium"
            >
              Upload documents first <ArrowRight className="w-3 h-3" />
            </button>
          )}
          <button
            id="new-chat-btn"
            onClick={onNewConversation}
            className="px-2.5 py-1 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors flex items-center gap-1 font-medium"
          >
            <Plus className="w-3 h-3" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white mb-4">
              <Bot className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-white tracking-tight">
              Agentic Document Assistant
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Ask questions grounded directly in your uploaded multi-format files.
              The LangGraph agent verifies context relevance, adaptively rewrites queries if needed,
              and cites factual sources.
            </p>

            {/* Starter Prompts */}
            <div className="w-full mt-6 space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-left">
                Suggested Questions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {starterQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    disabled={isProcessing}
                    className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-300 hover:text-white border border-slate-700/60 hover:border-teal-500/40 transition-all text-left flex items-start gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{q}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const isExpanded = !!expandedSources[index];

            return (
              <div
                key={index}
                className={`flex gap-3 max-w-3xl ${
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                    isUser
                      ? 'bg-slate-700 text-slate-200'
                      : 'bg-emerald-600 text-white shadow-teal-500/10'
                  }`}
                >
                  {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Box */}
                <div
                  className={`flex flex-col gap-1.5 ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-teal-600 text-white rounded-tr-xs shadow-md'
                        : 'bg-slate-800/90 text-slate-100 rounded-tl-xs border border-slate-700/70 shadow-sm'
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    )}
                  </div>

                  {/* Agentic RAG Metadata & Citations (Assistant messages) */}
                  {!isUser && msg.metadata && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5 px-1">
                      {msg.metadata.relevance_score !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-mono text-emerald-400">
                          Relevance: {Math.round((msg.metadata.relevance_score || 0) * 100)}%
                        </span>
                      )}
                      {msg.metadata.retrieved_chunk_count !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-mono text-slate-300">
                          {msg.metadata.retrieved_chunk_count} Chunks
                        </span>
                      )}
                      {msg.metadata.retry_count > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 font-mono text-amber-300">
                          Rewritten ({msg.metadata.retry_count} {msg.metadata.retry_count === 1 ? 'retry' : 'retries'})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Sources Collapsible Card */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="w-full mt-1">
                      <button
                        onClick={() => toggleSourceExpansion(index)}
                        className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium px-2 py-1 rounded-lg hover:bg-slate-800/60 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>
                          {msg.sources.length} Supporting Source{msg.sources.length > 1 ? 's' : ''}
                        </span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 max-w-2xl bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                          {msg.sources.map((src, sIdx) => (
                            <div
                              key={sIdx}
                              className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2 font-medium text-teal-300">
                                <span className="flex items-center gap-1 truncate">
                                  <FileText className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{src.document}</span>
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                  {src.page ? `Page ${src.page}` : ''}
                                  {src.sheet ? `Sheet: ${src.sheet}` : ''}
                                  {src.row_range ? `Rows: ${src.row_range}` : ''}
                                  {src.chunk_id ? ` [Chunk #${src.chunk_id}]` : ''}
                                </span>
                              </div>
                              {src.snippet && (
                                <p className="text-slate-400 font-mono text-[11px] bg-slate-950 p-1.5 rounded border border-slate-800/80 leading-relaxed">
                                  "{src.snippet}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Real-time Agent Thinking Indicator */}
        {isProcessing && (
          <div className="flex gap-3 max-w-xl mr-auto">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl rounded-tl-xs px-4 py-3 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-teal-300">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
                <span>{agentStep}</span>
              </div>
              <div className="w-48 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 animate-[pulse_1s_ease-in-out_infinite] w-3/4 rounded-full"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 sm:p-4 bg-slate-950/80 border-t border-slate-800">
        <div className="relative flex items-end gap-2 bg-slate-900 border border-slate-700/80 focus-within:border-teal-500 rounded-xl p-2 shadow-inner transition-colors">
          <textarea
            id="chat-query-input"
            ref={textareaRef}
            rows={1}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              documents.length === 0
                ? "No documents indexed yet. Upload documents or load sample documents to begin chatting..."
                : "Ask a grounded question about your documents... (Enter to send, Shift+Enter for newline)"
            }
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-32 px-2 py-1 leading-relaxed"
          />

          <button
            id="send-chat-btn"
            onClick={() => handleSendMessage()}
            disabled={isProcessing || !inputQuery.trim()}
            className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-colors shrink-0 shadow-sm"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
