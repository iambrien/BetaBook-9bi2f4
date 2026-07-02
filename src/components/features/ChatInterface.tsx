import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { ChatMessage } from '@/types';
import { generateId } from '@/lib/utils';
import { Send, Bot, User, RefreshCw, Sparkles } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: "Hello! I'm your BetaBook AI assistant. 👋\n\nAsk me anything about your business — your income, who owes you, top expenses, or general business advice. I analyze your live data to give accurate answers.",
  timestamp: new Date(),
};

const QUICK_PROMPTS = [
  "How much did I make this week?",
  "Who owes me money?",
  "What are my top expenses?",
  "Give me a business summary",
  "Tips to increase my sales?",
];

export default function ChatInterface() {
  const { user } = useAuth();
  const { activeBusinessId } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [messages, loading]);

  const fetchContext = async () => {
    const { data: txns } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(60);
    return txns || [];
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setError(null);

    const userMsg: ChatMessage = { id: generateId(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const context = await fetchContext();
    const history = messages
      .filter(m => m.id !== 'welcome')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: text });

    const { data, error: invokeError } = await supabase.functions.invoke('ai-chat', {
      body: { messages: history, context, businessId: activeBusinessId },
    });

    setLoading(false);

    if (invokeError) {
      let errorMessage = invokeError.message;
      if (invokeError instanceof FunctionsHttpError) {
        try {
          const statusCode = invokeError.context?.status ?? 500;
          const textContent = await invokeError.context?.text();
          errorMessage = `[Code: ${statusCode}] ${textContent || invokeError.message}`;
        } catch { /* ignore */ }
      }
      console.error('AI error:', errorMessage);
      setError('Could not reach AI. Please check connection and try again.');
      return;
    }

    // Handle server-side error returned in body
    if (data?.error) {
      console.error('AI responded with error:', data.error);
      setError(data.error.includes('balance') || data.error.includes('402')
        ? 'AI credits are currently unavailable. Contact support at contact@onspace.ai'
        : `AI error: ${data.error}`
      );
      return;
    }

    const aiMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: data?.message || "Sorry, something went wrong. Please try again.",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMsg]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const retryLast = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) {
      setError(null);
      sendMessage(lastUser.content);
    }
  };

  const clearChat = () => {
    setMessages([WELCOME]);
    setError(null);
    setInput('');
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-4 min-h-0">

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i}
                    className="w-2 h-2 rounded-full bg-blue-300 animate-bounce"
                    style={{ animationDelay: `${i * 0.18}s` }}
                  />
                ))}
                <span className="text-gray-400 text-xs ml-1">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 flex-shrink-0">
              <Bot className="w-4 h-4 text-red-400" />
            </div>
            <div className="bg-red-50 border border-red-100 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[78%]">
              <p className="text-red-600 text-sm leading-relaxed">{error}</p>
              <button
                onClick={retryLast}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Try again
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts — show when few messages */}
      {messages.length <= 2 && !loading && (
        <div className="px-4 pb-3 flex-shrink-0">
          <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Quick questions
          </p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {QUICK_PROMPTS.map(p => (
              <button key={p}
                onClick={() => sendMessage(p)}
                className="flex-shrink-0 px-3.5 py-2 bg-white border border-gray-200 rounded-2xl text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm active:scale-95"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clear chat if has messages */}
      {messages.length > 3 && (
        <div className="px-4 pb-1 flex-shrink-0 flex justify-end">
          <button onClick={clearChat} className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Clear chat
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-gray-100 bg-white">
        <div className={cn(
          "flex items-center gap-2 bg-gray-50 rounded-2xl border px-4 py-2.5 transition-all",
          loading ? "border-gray-100 opacity-70" : "border-gray-200 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 focus-within:bg-white"
        )}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder={loading ? "AI is thinking..." : "Ask about your business..."}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center transition-all disabled:opacity-40 active:scale-95 hover:bg-blue-600 flex-shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-center text-gray-300 text-[10px] mt-1.5">
          Powered by OnSpace AI · Analyzes your live data
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex items-end gap-2', isUser ? 'flex-row-reverse' : '')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={cn(
        'max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
        isUser
          ? 'bg-blue-500 text-white rounded-br-sm shadow-md shadow-blue-200'
          : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100 shadow-sm'
      )}>
        {msg.content}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-gray-500" />
        </div>
      )}
    </div>
  );
}
