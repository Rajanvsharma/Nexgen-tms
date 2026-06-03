'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Minimize2, Maximize2, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAccessToken } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'What loads are currently in transit?',
  'Which carriers have expiring insurance?',
  'Show me pending quotes',
  'Draft a rate confirmation email',
  'What are my unpaid invoices?',
  'Suggest a carrier for Dallas TX to Los Angeles CA dry van',
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-2 mb-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-brand text-white rounded-tr-sm'
          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
      )}>
        {message.content.split('\n').map((line, i) => (
          <span key={i}>
            {line}
            {i < message.content.split('\n').length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CopilotChat() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m your NexGen Copilot. I have live access to your loads, carriers, quotes, and compliance data. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    function onAsk(e: Event) {
      const q = (e as CustomEvent<string>).detail;
      setOpen(true);
      setTimeout(() => sendMessage(q), 100);
    }
    window.addEventListener('copilot:ask', onAsk);
    return () => window.removeEventListener('copilot:ask', onAsk);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text?: string) {
    const content = (text || input).trim();
    if (!content || streaming) return;

    setInput('');
    setError('');
    const userMsg: Message = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStreaming(true);

    // Add empty assistant message to stream into
    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMsg]);

    try {
      const response = await fetch('http://localhost:4000/api/copilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken() || ''}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to get response');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullText += parsed.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: fullText };
                  return updated;
                });
              }
              if (parsed.error) throw new Error(parsed.error);
            } catch { /* skip non-JSON lines */ }
          }
        }
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Something went wrong';
      setError(msg);
      setMessages(prev => prev.slice(0, -1)); // remove empty assistant msg
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const panelClass = maximized
    ? 'fixed inset-4 z-50 flex flex-col rounded-2xl shadow-2xl bg-white'
    : 'fixed bottom-24 right-6 z-50 w-[400px] h-[560px] flex flex-col rounded-2xl shadow-2xl bg-white';

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200',
          open ? 'bg-gray-700 rotate-90' : 'bg-brand hover:bg-brand-light'
        )}
        title="AI Copilot"
      >
        {open ? <X className="h-6 w-6 text-white" /> : <Bot className="h-6 w-6 text-white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className={panelClass}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-brand text-white rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">NexGen Copilot</p>
                <p className="text-xs text-blue-200">Powered by Claude AI · Live TMS data</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMaximized((m) => !m)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title={maximized ? 'Minimize' : 'Maximize'}
              >
                {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {streaming && messages[messages.length - 1]?.content === '' && (
              <div className="flex gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (shown when only 1 message) */}
          {messages.length === 1 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-gray-400 mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs bg-gray-100 hover:bg-brand hover:text-white text-gray-600 px-3 py-1.5 rounded-full transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0">
            <div className="flex gap-2 items-center bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand transition-all">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about loads, carriers, rates…"
                disabled={streaming}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 text-gray-800"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || streaming}
                className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center disabled:opacity-40 hover:bg-brand-light transition-colors shrink-0"
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">Has live access to your TMS data</p>
          </div>
        </div>
      )}
    </>
  );
}
