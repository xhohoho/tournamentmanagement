'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTourney } from '@/lib/context';
import type { ChatMessage } from '@/lib/types';

const CHAT_NAME_KEY = 'chat:name';

function timeLabel(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Single chat bubble */
function Bubble({ msg, self }: { msg: ChatMessage; self: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 ${self ? 'items-end' : 'items-start'}`}>
      <div className="flex items-baseline gap-1.5 px-1">
        {!self && (
          <span className="font-['DM_Mono'] text-[10px] font-bold" style={{ color: 'var(--accent)' }}>
            {msg.name}
          </span>
        )}
        <span className="font-['DM_Mono'] text-[9px]" style={{ color: 'var(--text-dim)' }}>
          {timeLabel(msg.ts)}
        </span>
      </div>
      <div
        className="max-w-[85%] px-3 py-1.5 rounded-2xl font-['Syne'] text-xs leading-relaxed"
        style={{
          background: self ? 'var(--accent)' : 'var(--bg-elevated)',
          color: self ? 'white' : 'var(--text)',
          borderBottomRightRadius: self ? 4 : undefined,
          borderBottomLeftRadius: !self ? 4 : undefined,
          border: self ? 'none' : '1px solid var(--border)',
          wordBreak: 'break-word',
        }}
      >
        {msg.text}
      </div>
    </div>
  );
}

interface ChatPanelProps {
  /** controlled open state from parent */
  open: boolean;
  onToggle: () => void;
}

export function ChatPanel({ open, onToggle }: ChatPanelProps) {
  const { chatMessages, sendChat, clearChat, isAdmin } = useTourney();

  const [chatName, setChatName] = useState<string>('');
  const [nameInput, setNameInput] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore saved name
  useEffect(() => {
    const saved = localStorage.getItem(CHAT_NAME_KEY);
    if (saved) { setChatName(saved); setNameSet(true); }
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const confirmName = () => {
    const n = nameInput.trim();
    if (!n || n.length > 24) return;
    setChatName(n);
    setNameSet(true);
    localStorage.setItem(CHAT_NAME_KEY, n);
  };

  const handleSend = useCallback(async () => {
    const t = text.trim();
    if (!t || sending || !chatName) return;
    setSending(true);
    setText('');
    const result = await sendChat(chatName, t);
    if (result.error) {
      setText(t);
      setStatusMsg(`❌ ${result.error}`);
      setTimeout(() => setStatusMsg(null), 2500);
    }
    setSending(false);
    inputRef.current?.focus();
  }, [text, sending, chatName, sendChat]);

  const handleClear = async () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    await clearChat();
    setClearConfirm(false);
  };

  const unread = chatMessages.length;

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={onToggle}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg font-['DM_Mono'] text-xs font-bold transition-all cursor-pointer"
        style={{
          background: open ? 'var(--accent)' : 'var(--bg-surface)',
          color: open ? 'white' : 'var(--text)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border-mid)'}`,
          boxShadow: open
            ? '0 4px 24px rgba(77,124,255,0.35)'
            : '0 4px 16px rgba(0,0,0,0.15)',
        }}
        aria-label="Toggle chat"
      >
        <span>{open ? '✕' : '💬'}</span>
        <span>{open ? 'Close' : 'Chat'}</span>
        {!open && unread > 0 && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[9px] font-bold"
            style={{ background: 'var(--accent-red)' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-16 right-5 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{
            width: 320,
            height: 480,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
          }}
        >
          {/* Header */}
          <div
            className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
          >
            <div className="flex items-center gap-2">
              <span className="font-['Bebas_Neue'] text-base tracking-widest t-text">💬 Chat</span>
              <span
                className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold"
                style={{ background: 'var(--accent-red)' }}
              >
                {chatMessages.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {nameSet && (
                <button
                  className="font-['DM_Mono'] text-[9px] px-2 py-0.5 rounded-md t-muted hover:t-text border transition-colors cursor-pointer"
                  style={{ borderColor: 'var(--border-mid)', background: 'transparent' }}
                  onClick={() => { setNameSet(false); setNameInput(chatName); }}
                  title="Change your name"
                >
                  ✏ {chatName}
                </button>
              )}
              {isAdmin && chatMessages.length > 0 && (
                <button
                  className="font-['DM_Mono'] text-[9px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer"
                  style={{
                    borderColor: clearConfirm ? 'var(--accent-red)' : 'var(--border-mid)',
                    color: clearConfirm ? 'var(--accent-red)' : 'var(--text-muted)',
                    background: clearConfirm ? 'rgba(232,41,74,0.08)' : 'transparent',
                  }}
                  onClick={handleClear}
                >
                  {clearConfirm ? '⚠ Confirm?' : '🗑 Clear'}
                </button>
              )}
            </div>
          </div>

          {/* Name setup screen */}
          {!nameSet ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <div className="text-center">
                <div className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-1">Set Your Name</div>
                <p className="font-['DM_Mono'] text-[10px] t-muted">This is how others will see your messages</p>
              </div>
              <input
                type="text"
                className="w-full rounded-lg px-3 py-2 font-['Syne'] text-sm outline-none border t-text"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}
                placeholder="Your name…"
                maxLength={24}
                autoComplete="off"
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmName()}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
              />
              <button
                className="w-full py-2 rounded-lg font-['DM_Mono'] text-xs font-bold cursor-pointer transition-opacity"
                style={{ background: 'var(--accent)', color: 'white', opacity: nameInput.trim() ? 1 : 0.5 }}
                disabled={!nameInput.trim()}
                onClick={confirmName}
              >
                Join Chat →
              </button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
                {chatMessages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="font-['DM_Mono'] text-[10px] t-dim text-center">
                      No messages yet.<br />Be the first to say something!
                    </p>
                  </div>
                ) : (
                  chatMessages.map(msg => (
                    <Bubble key={msg.id} msg={msg} self={msg.name === chatName} />
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Status */}
              {statusMsg && (
                <div className="shrink-0 px-4 py-1 font-['DM_Mono'] text-[10px]" style={{ color: 'var(--accent-red)', background: 'rgba(232,41,74,0.06)' }}>
                  {statusMsg}
                </div>
              )}

              {/* Input */}
              <div
                className="shrink-0 flex items-center gap-2 px-3 py-2 border-t"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  className="flex-1 rounded-lg px-3 py-1.5 font-['Syne'] text-xs outline-none border t-text"
                  style={{
                    background: 'var(--bg-surface)',
                    borderColor: 'var(--border-mid)',
                    opacity: sending ? 0.6 : 1,
                  }}
                  placeholder={sending ? 'Sending…' : 'Type a message…'}
                  maxLength={300}
                  autoComplete="off"
                  disabled={sending}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
                />
                <button
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-opacity"
                  style={{
                    background: text.trim() && !sending ? 'var(--accent)' : 'var(--bg-elevated)',
                    opacity: text.trim() && !sending ? 1 : 0.5,
                    border: '1px solid var(--border-mid)',
                  }}
                  disabled={!text.trim() || sending}
                  onClick={handleSend}
                  aria-label="Send"
                >
                  <span style={{ color: text.trim() && !sending ? 'white' : 'var(--text-dim)', fontSize: 14 }}>↑</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
