'use client';

import { useState, useEffect } from 'react';
import { useTourney } from '@/lib/context';
import { AdminModal } from '@/components/AdminModal';
import { PlayersTab } from '@/components/PlayersTab';
import { TeamsTab } from '@/components/TeamsTab';
import { BracketTab } from '@/components/BracketTab';
import { MapsTab } from '@/components/MapsTab';
import { ChatPanel } from '@/components/ChatPanel';
import BottomTicker from '@/components/BottomTicker';
import type { TabId } from '@/lib/types';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'players', icon: '👥', label: 'Players' },
  { id: 'teams',   icon: '🛡',  label: 'Teams'   },
  { id: 'bracket', icon: '🏆', label: 'Bracket'  },
  { id: 'maps',    icon: '🗺',  label: 'Maps'     },
];

export default function Home() {
  const { isAdmin, adminToken, setIsAdmin, players, roster, loading, resetAll, spinQueue, spinItemCategory, tickerText, setTickerText } = useTourney();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredSpinResults = activeCategory
    ? spinQueue.filter((_, i) => spinItemCategory[i] === activeCategory)
    : spinQueue;

  const [activeTab, setActiveTab] = useState<TabId>('players');
  const [adminOpen, setAdminOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  // Ticker edit state
  const [tickerEditOpen, setTickerEditOpen] = useState(false);
  const [tickerDraft, setTickerDraft] = useState('');
  const [tickerSaving, setTickerSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored === 'true') setDark(true);
  }, []);

  const toggleDark = () => setDark(prev => {
    localStorage.setItem('darkMode', String(!prev));
    return !prev;
  });

  const handleAdminBtn = () => {
    if (isAdmin) { setIsAdmin(false); return; }
    setAdminOpen(true);
  };

  const handleReset = async () => {
    if (!resetConfirm) { setResetConfirm(true); setTimeout(() => setResetConfirm(false), 3000); return; }
    await resetAll();
    setResetConfirm(false);
  };

  const openTickerEdit = () => {
    setTickerDraft(tickerText);
    setTickerEditOpen(true);
  };

  const saveTickerText = async () => {
    setTickerSaving(true);
    await setTickerText(tickerDraft);
    setTickerSaving(false);
    setTickerEditOpen(false);
  };

  if (loading) {
    return (
      <div className={`${dark ? 'dark' : ''} h-screen w-screen flex items-center justify-center t-bg`}>
        <div className="text-center">
          <div className="font-['Bebas_Neue'] text-5xl tracking-widest bg-gradient-to-r from-[var(--accent-red)] to-[var(--accent)] bg-clip-text text-transparent mb-4">
            ⚔ TOURNEY
          </div>
          <div className="font-['DM_Mono'] text-xs t-muted animate-pulse">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${dark ? 'dark' : ''} t-bg h-screen overflow-hidden flex flex-col`}>

      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 20% 10%, var(--grad-start) 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 80% 90%, var(--grad-end) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col h-full min-h-0">

        {/* Header */}
        <header className="t-header backdrop-blur-md border-b t-border shrink-0 z-40">
          <div className="w-full px-8 py-3 flex items-center justify-between">
            <div className="font-['Bebas_Neue'] text-2xl tracking-widest bg-gradient-to-r from-[var(--accent-red)] to-[var(--accent)] bg-clip-text text-transparent">
              ⚔ TOURNEY
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleDark}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border t-border-mid t-muted t-elevated font-['DM_Mono'] text-xs transition-all hover:border-[var(--border)] hover:t-text cursor-pointer"
              >
                {dark ? '☀️ Light' : '🌙 Dark'}
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={openTickerEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border t-border-mid t-muted t-elevated font-['DM_Mono'] text-xs transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer"
                  >
                    📢 Ticker
                  </button>
                  <button
                    onClick={handleReset}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-['DM_Mono'] text-xs transition-all cursor-pointer ${
                      resetConfirm
                        ? 'border-[var(--accent-red)] text-[var(--accent-red)] bg-[rgba(232,41,74,0.1)]'
                        : 't-border-mid t-muted t-elevated hover:border-[var(--accent-red)] hover:text-[var(--accent-red)]'
                    }`}
                  >
                    {resetConfirm ? '⚠ Confirm Reset?' : '🔄 Reset All'}
                  </button>
                </>
              )}
              <button
                onClick={handleAdminBtn}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-['DM_Mono'] text-xs transition-all cursor-pointer ${
                  isAdmin
                    ? 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[rgba(255,176,32,0.1)]'
                    : 't-border-mid t-muted t-elevated hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]'
                }`}
              >
                <span>{isAdmin ? '🔓' : '🔒'}</span>
                <span>{isAdmin ? 'Admin ✓' : 'Admin'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Tab nav */}
        <nav className="t-surface border-b t-border shrink-0">
          <div className="w-full px-8 flex overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 font-['DM_Mono'] text-xs tracking-widest uppercase border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(77,124,255,0.06)]'
                    : 'border-transparent t-muted hover:t-text hover:bg-[rgba(128,128,255,0.04)]'
                }`}
              >
                {tab.icon} {tab.label}
                {tab.id === 'players' && (players.length > 0 || roster.length > 0) && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent-red)] text-white text-[9px] font-bold">
                    {roster.length > 0 ? roster.length : players.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Main */}
        <main className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col px-8">
            <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'players' ? '' : 'hidden'}`}><PlayersTab /></div>
            <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'teams'   ? '' : 'hidden'}`}><TeamsTab /></div>
            <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'bracket' ? '' : 'hidden'}`}><BracketTab spinResults={filteredSpinResults} /></div>
            <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'maps'    ? '' : 'hidden'}`}><MapsTab activeCategory={activeCategory} setActiveCategory={setActiveCategory} /></div>
          </div>
        </main>

        <BottomTicker text={tickerText} />
      </div>

      <AdminModal open={adminOpen} onClose={() => setAdminOpen(false)} />
      <ChatPanel open={chatOpen} onToggle={() => setChatOpen(o => !o)} />

      {/* Ticker edit modal */}
      {tickerEditOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setTickerEditOpen(false); }}
        >
          <div className="bg-[#0f0f1a] border border-[#32324a] rounded-2xl p-7 w-[460px] max-w-[95vw] animate-scale-in">
            <h2 className="font-['Bebas_Neue'] text-3xl tracking-widest mb-1">📢 TICKER TEXT</h2>
            <p className="text-[#7878a0] text-sm mb-5">Edit the scrolling message shown at the bottom of the page.</p>

            <textarea
              className="w-full bg-[#161625] border border-[#32324a] rounded-xl px-4 py-3 text-[#dde0f0] font-['DM_Mono'] text-sm outline-none focus:border-[#4d7cff] transition-colors resize-none"
              rows={3}
              placeholder="Enter ticker text…"
              value={tickerDraft}
              onChange={e => setTickerDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveTickerText(); }}
            />

            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 py-2.5 rounded-xl bg-[#161625] border border-[#32324a] text-[#dde0f0] font-bold text-sm hover:border-[#4d7cff] hover:text-[#4d7cff] transition-colors cursor-pointer"
                onClick={() => setTickerEditOpen(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl bg-[#4d7cff] text-white font-bold text-sm hover:bg-[#3a6bff] transition-colors disabled:opacity-40 cursor-pointer"
                onClick={saveTickerText}
                disabled={tickerSaving || !tickerDraft.trim()}
              >
                {tickerSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
