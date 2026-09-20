import React from 'react';
import { MessageSquare, Plus, Trash2, Clock } from 'lucide-react';
import { Conversation } from '../types';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) => {
  return (
    <div id="conversation-sidebar" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[calc(100vh-8.5rem)] shadow-xl">
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
          Chat Threads
        </h3>
        <button
          id="sidebar-new-chat-btn"
          onClick={onNewConversation}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="New conversation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No past conversations. Click + or ask a question to start one.
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-600/20 text-teal-300 font-medium border border-teal-500/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                }`}
                onClick={() => onSelectConversation(conv.id)}
              >
                <div className="truncate flex-1">
                  <p className="truncate">{conv.title}</p>
                  <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700/60 text-slate-400 hover:text-rose-400 transition-opacity"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
