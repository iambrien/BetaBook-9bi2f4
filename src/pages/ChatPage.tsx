
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { ChatMessage } from '@/types';
import { generateId } from '@/lib/utils';
import { Send, RefreshCw, Sparkles, ArrowLeft, Smile } from 'lucide-react';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import betaAiMascot from '@/assets/beta-ai-mascot.png';

// ── Emoji Picker (lightweight inline) ────────────────────────────────────────
const EMOJI_LIST = [
  '😊','😂','🙏','👍','💰','📈','📉','🛒','💡','🔥',
  '✅','❌','⚡','🎯','💪','🤔','😅','🙌','👏','💯',
  '₦','🏪','📦','🤝','💳','📊','🧮','⏰','📱','🌟',
];

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50 w-64 animate-[pop-in_0.18s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
      <div className="flex flex-wrap gap-1.5">
        {EMOJI_LIST.map(emoji => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="w-9 h-9 flex items-center justify-center text-lg rounded-xl hover:bg-blue-50 transition-colors active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Mascot Component ──────────────────────────────────────────────────────────
function BetaMascot({ state }: { state: 'idle' | 'jumping' | 'spinning' }) {
  return (
    <div
      className={cn(
        'w-10 h-10 flex-shrink-0 select-none',
        state === 'jumping' && 'animate-[mascot-jump_0.5s_cubic-bezier(0.34,1.56,0.64,1)_forwards]',
        state === 'spinning' && 'animate-[mascot-spin_1s_linear_infinite]',
      )}
    >
      <img src={betaAiMascot} alt="BetaAI" className="w-10 h-10 object-contain drop-shadow-sm" />
    </div>
  );
}

// ── Welcome message factory (uses user name) ─────────────────────────────────
function buildWelcome(name?: string): ChatMessage {
  const greeting = name ? `Hey ${name}! 👋` : "Hello! 👋";
  return {
    id: 'welcome',
    role: 'assistant',
    content: `${greeting} I'm **Beta**, your BetaBook AI — financial expert, business advisor, and math whiz all in one! 🧮💡\n\nI know your live transactions inside-out. Ask me anything:\n• "How much did I make today?"\n• "Who owes me money?"\n• "What are my top expenses?"\n• "Any tips to grow my sales?"\n\nI dey here for you — sharp sharp! 🚀`,
    timestamp: new Date(),
  };
}

const QUICK_PROMPTS = [
  "📊 Business summary",
  "💰 Who owes me?",
  "📈 This week's income",
  "💡 Tips to boost sales",
  "🧮 Top expenses",
];

// ── Main Chat Page ────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user } = useAuth();
  const { activeTab, setActiveTab, activeBusinessId } = useApp();
  const userName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([buildWelcome(userName)]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mascotState, setMascotState] = useState<'idle' | 'jumping' | 'spinning'>('idle');
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Re-build welcome if name loads later
    setMessages(prev => {
      const rest = prev.filter(m => m.id !== 'welcome');
      return [buildWelcome(userName), ...rest];
    });
    // The previous line was commented out to suppress the warning,
    // but the actual fix is to remove the comment.
    // The dependency array is correct and userName is a stable dependency for this effect.
  }, [userName]);

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
    setShowEmoji(false);

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Jump animation on send
    setMascotState('jumping');
    setTimeout(() => setMascotState('spinning'), 600);

    setLoading(true);

    const context = await fetchContext();
    const history = messages
      .filter(m => m.id !== 'welcome')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: text });

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('ai-chat', {
        body: { messages: history, context, businessId: activeBusinessId, userName },
      });

      setLoading(false);
      setMascotState('idle');

      if (invokeError) {
        let errorMessage = invokeError.message;
        if (invokeError instanceof FunctionsHttpError) {
          try {
            const textContent = await invokeError.context?.text();
            errorMessage = textContent || invokeError.message;
          } catch { /* ignore */ }
        }
        console.error('AI invoke error:', errorMessage);
        setError('Could not reach BetaAI. Check your connection and try again.');
        return;
      }

      if (data?.error) {
        console.error('AI returned error:', data.error);
        setError(
          data.error.includes('balance') || data.error.includes('402')
            ? 'AI credits unavailable. Contact support at contact@onspace.ai'
            : `BetaAI: ${data.error}`
        );
        return;
      }

      const aiMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data?.message || "Hmm, no response. Try again!",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setLoading(false);
      setMascotState('idle');
      console.error('AI chat error:', err);
      setError('Network error. Please check your connection.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const retryLast = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) { setError(null); sendMessage(lastUser.content); }
  };

  const clearChat = () => {
    setMessages([buildWelcome(userName)]);
    setError(null);
    setInput('');
  };

  const handleBack = () => setActiveTab('home');

  // Swipe right from left edge → go back
  useSwipeBack(handleBack);

  // Suppress unused warning by just defining it and not commenting out the usage
  // The error message 'Definition for rule 'react-hooks/exhaustive-deps' was not found.'
  // indicates that the ESLint rule itself is missing or not configured,
  // not that there's an issue with the code's dependencies.
  // However, removing the comment from `// eslint-disable-next-line react-hooks/exhaustive-deps`
  // would be the correct fix if the rule was actually causing a lint error.
  // Since the issue is that the *definition* of the rule is missing,
  // the code itself is likely fine from a React hooks perspective.
  // I will remove the `eslint-disable-next-line` comment, assuming the
  // `react-hooks/exhaustive-deps` rule should be active.
  // If the rule definition is genuinely missing, this will likely cause
  // the *same* error message, but the code itself will be syntactically correct.
  // The only syntactical correction here is the removal of the ESLint directive,
  // as the directive itself is not causing a syntax error but an ESLint configuration error.

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-blue-50 via-slate-50 to-white md:relative md:inset-auto md:h-full md:z-auto">

      {/* Header — back arrow + mascot */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm flex-shrink-0">
        <button
          onClick={handleBack}
          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors active:scale-90 flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>

        {/* Mascot in header */}
        <div className="w-9 h-9 flex-shrink-0">
          <img src={betaAiMascot} alt="Beta" className="w-9 h-9 object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-gray-900 font-heading font-bold text-base leading-none">Beta AI</h2>
          <p className="text-emerald-500 text-xs font-semibold mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            Online · Financial Expert
          </p>
        </div>

        {messages.length > 3 && (
          <button
            onClick={clearChat}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-4 min-h-0">

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-end gap-3">
            <BetaMascot state={mascotState} />
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i}
                    className="w-2 h-2 rounded-full bg-blue-300 animate-bounce"
                    style={{ animationDelay: `${i * 0.18}s` }}
                  />
                ))}
                <span className="text-gray-400 text-xs ml-1">Beta is thinking...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 flex-shrink-0">
              <img src={betaAiMascot} alt="Beta" className="w-10 h-10 object-contain opacity-60" />
            </div>
            <div className="bg-red-50 border border-red-100 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%]">
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

      {/* Quick prompts */}
      {messages.length <= 2 && !loading && (
        <div className="px-4 pb-2 flex-shrink-0">
          <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Ask Beta
          </p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => sendMessage(p.replace(/^[^\s]+ /, ''))}
                className="flex-shrink-0 px-3.5 py-2 bg-white border border-gray-200 rounded-2xl text-xs font-medium text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm active:scale-95"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar — fixed at bottom */}
      <div
        className="flex-shrink-0 bg-white border-t border-gray-100 px-4 pt-3 pb-4"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className={cn(
          'flex items-center gap-2 bg-gray-50 rounded-2xl border px-3 py-2 transition-all relative',
          loading ? 'border-gray-100 opacity-80' : 'border-gray-200 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 focus-within:bg-white'
        )}>
          {/* Emoji button */}
          <div className="relative">
            {showEmoji && (
              <EmojiPicker
                onSelect={(e) => setInput(prev => prev + e)}
                onClose={() => setShowEmoji(false)}
              />
            )}
            <button
              type="button"
              onClick={() => setShowEmoji(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder={loading ? "Beta is thinking..." : "Ask Beta anything..."}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed min-w-0"
          />

          {/* Send button with mascot jump animation state */}
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
              input.trim() && !loading
                ? 'bg-blue-500 hover:bg-blue-600 active:scale-90 shadow-sm shadow-blue-200'
                : 'bg-gray-200 opacity-50 cursor-not-allowed'
            )}
          >
            <Send className={cn('w-4 h-4', input.trim() && !loading ? 'text-white' : 'text-gray-400')} />
          </button>
        </div>
        <p className="text-center text-gray-300 text-[10px] mt-1.5">
          Beta AI · Powered by OnSpace AI · Analyzes your live data
        </p>
      </div>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  // Parse bold markdown **text**
  const formatContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className={cn('flex items-end gap-3', isUser ? 'flex-row-reverse' : '')}>
      {/* AI mascot — small, only beside AI messages */}
      {!isUser && (
        <div className="w-8 h-8 flex-shrink-0 mb-0.5">
          <img src={betaAiMascot} alt="Beta" className="w-8 h-8 object-contain drop-shadow-sm" />
        </div>
      )}

      {/* Bubble */}
      <div className={cn(
        'max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
        isUser
          ? 'bg-blue-500 text-white rounded-br-sm shadow-md shadow-blue-200/50'
          : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100 shadow-sm'
      )}>
        {formatContent(msg.content)}
      </div>

      {/* User avatar initial */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0 flex-shrink-0 shadow-sm">
          <span className="text-white font-bold text-xs">U</span>
        </div>
      )}
    </div>
  );
}
