import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Copy, Check, Loader2, X, MessageSquare, Plus, Trash2, Edit2, ChevronDown } from 'lucide-react';
import { useConversations, useMessages, useAIStatus, useModels, useSettings } from '../hooks/useElectron';
import { AIProviderType } from '@shared/types';

export default function Chat() {
  const { conversations, loading: convLoading, createConversation, deleteConversation, renameConversation } = useConversations();
  const { messages, loading: msgLoading, sendMessage, refetch: refetchMessages } = useMessages(
    conversations.find(c => c.id === activeConversationId)?.id || null
  );
  const { status } = useAIStatus();
  const { models } = useModels();
  const { settings, updateSettings } = useSettings();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  const handleNewChat = async () => {
    const conv = await createConversation('New Conversation');
    setActiveConversationId(conv.id);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeConversationId || sending) return;

    const content = input;
    setInput('');
    setSending(true);
    setStreaming(true);

    try {
      await sendMessage(content);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
      setStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const currentConversation = conversations.find(c => c.id === activeConversationId);
  const ollamaModels = models.filter(m => !m.name.includes('groq') && !m.name.includes('mixtral') && !m.name.includes('gemma'));
  const groqModels = models.filter(m => m.name.includes('groq') || m.name.includes('mixtral') || m.name.includes('gemma') || m.name.includes('llama-3'));

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Chat</h1>
          <p className="text-slate-400">AI-powered conversations with local & cloud models</p>
        </div>
        <button onClick={handleNewChat} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden bg-slate-900/30 border border-slate-800 rounded-xl">
        <aside className="w-72 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold text-white">Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convLoading ? (
              <div className="p-4 text-center text-slate-400">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-slate-400">No conversations yet</div>
            ) : (
              <ul className="p-2 space-y-1">
                {conversations.map(conv => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    active={conv.id === activeConversationId}
                    onSelect={() => setActiveConversationId(conv.id)}
                    onDelete={() => deleteConversation(conv.id)}
                    onRename={() => {
                      setEditingId(conv.id);
                      setEditTitle(conv.title);
                    }}
                    editing={editingId === conv.id}
                    editTitle={editTitle}
                    setEditTitle={setEditTitle}
                    onSaveEdit={() => {
                      if (editTitle.trim()) renameConversation(conv.id, editTitle.trim());
                      setEditingId(null);
                    }}
                    onCancelEdit={() => setEditingId(null)}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          {activeConversationId ? (
            <>
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="font-medium text-white">{currentConversation?.title || 'New Conversation'}</h3>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span>{messages.length} messages</span>
                      {currentConversation?.model && (
                        <>
                          <span>•</span>
                          <span>{currentConversation.model}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={settings?.ai.provider || 'auto'}
                    onChange={e => updateSettings({ ai: { ...settings!.ai, provider: e.target.value as AIProviderType } })}
                    className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="auto">Auto</option>
                    <option value="ollama">Ollama</option>
                    <option value="groq">Groq</option>
                  </select>
                  <select
                    value={settings?.ai.ollamaModel || ''}
                    onChange={e => updateSettings({ ai: { ...settings!.ai, ollamaModel: e.target.value } })}
                    className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 max-w-[150px]"
                  >
                    {ollamaModels.map(m => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={messagesEndRef}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-lg">Start a conversation</p>
                    <p className="text-sm">Type a message below to begin</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <MessageBubble key={msg.id} message={msg} index={idx} />
                  ))
                )}
                {streaming && <TypingIndicator />}
              </div>

              <form onSubmit={handleSend} className="p-4 border-t border-slate-800">
                <div className="flex items-end gap-3">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message JARVIS... (Shift+Enter for new line)"
                    rows={1}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                    aria-label="Send message"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Provider: {settings?.ai.provider === 'auto' ? 'Auto' : settings?.ai.provider} •
                  Model: {settings?.ai.provider === 'groq' ? settings?.ai.groqModel : settings?.ai.ollamaModel} •
                  {settings?.ai.stream ? 'Streaming' : 'Non-streaming'}
                </p>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <p>Select or create a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationItem({ conversation, active, onSelect, onDelete, onRename, editing, editTitle, setEditTitle, onSaveEdit, onCancelEdit }: any) {
  if (editing) {
    return (
      <li className="flex items-center gap-2 px-2 py-1">
        <input
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSaveEdit()}
          onBlur={onCancelEdit}
          autoFocus
          className="flex-1 px-2 py-1 bg-slate-800 border border-blue-500 rounded text-sm text-white focus:outline-none"
        />
        <button onClick={onSaveEdit} className="p-1 text-green-400 hover:bg-green-500/20 rounded"><Check className="w-4 h-4" /></button>
        <button onClick={onCancelEdit} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><X className="w-4 h-4" /></button>
      </li>
    );
  }

  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
          active ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'
        }`}
      >
        <MessageSquare className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
        <span className="flex-1 truncate font-medium">{conversation.title}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="p-1 text-slate-400 hover:text-white rounded"><Edit2 className="w-3 h-3" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-slate-400 hover:text-red-400 rounded"><Trash2 className="w-3 h-3" /></button>
        </div>
      </button>
    </li>
  );
}

function MessageBubble({ message, index }: { message: any; index: number }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const copyContent = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-slate-700' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block px-4 py-2 rounded-2xl ${isUser ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-white rounded-tl-none'}`}>
          <pre className="whitespace-pre-wrap text-sm">{message.content}</pre>
        </div>
        <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-slate-500">{new Date(message.timestamp).toLocaleTimeString()}</span>
          {message.metadata?.model && <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700 rounded">{message.metadata.model}</span>}
          <button onClick={copyContent} className="p-1 text-slate-400 hover:text-white rounded" title="Copy">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 text-xs text-slate-400">
            Tools: {message.toolCalls.map((tc: any) => tc.function.name).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-slate-800 rounded-2xl rounded-tl-none px-4 py-2">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}