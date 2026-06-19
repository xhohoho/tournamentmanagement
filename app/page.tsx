'use client';

import { useState, useEffect } from 'react';
import { TourneyProvider } from '@/lib/context';
import { TournamentPicker } from '@/components/TournamentPicker';
import { AdminModal } from '@/components/AdminModal';
import { PlayersTab } from '@/components/PlayersTab';
import { TeamsTab } from '@/components/TeamsTab';
import { BracketTab } from '@/components/BracketTab';
import { MapsTab } from '@/components/MapsTab';
import { FFATab } from '@/components/FFATab';
import { CasterSheetTab } from '@/components/CasterSheetTab';
import { ChatPanel } from '@/components/ChatPanel';
import BottomTicker from '@/components/BottomTicker';
import { useTourney } from '@/lib/context';
import { useAdminSession } from '@/hooks/useAdminSession';
import type { TabId } from '@/lib/types';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'players', icon: '👥', label: 'Players' },
  { id: 'teams',   icon: '🛡',  label: 'Teams'   },
  { id: 'bracket', icon: '🏆', label: 'Bracket'  },
  { id: 'caster',  icon: '🎙', label: 'Match Info' },
  { id: 'maps',    icon: '🗺',  label: 'Maps'     },
  { id: 'ffa',     icon: '🎮', label: 'FFA'      },
];

// ─── TickerEditModal ──────────────────────────────────────────────────────────
function TickerEditModal({ open, tickerText, onClose, onSave }: {
  open: boolean;
  tickerText: string;
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(tickerText);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setDraft(tickerText); }, [open, tickerText]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="t-surface border t-border rounded-2xl p-7 w-[460px] max-w-[95vw] animate-scale-in shadow-xl">
        <h2 className="font-['Bebas_Neue'] text-3xl tracking-widest mb-1 t-text">📢 TICKER TEXT</h2>
        <p className="t-muted text-sm mb-5">Edit the scrolling message shown at the bottom of the page.</p>
        <textarea
          className="w-full t-elevated border t-border-mid rounded-xl px-4 py-3 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none"
          rows={3}
          placeholder="Enter ticker text…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(); }}
        />
        <div className="flex gap-3 mt-4">
          <button
            className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-bold text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            onClick={onClose}
          >Cancel</button>
          <button
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
            style={{ background: 'var(--accent)' }}
            onClick={handleSave}
            disabled={saving || !draft.trim()}
          >{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
TickerEditModal.displayName = 'TickerEditModal';

// ─── Inner app — must be inside TourneyProvider ───────────────────────────────
function MainApp({ tournamentId, onChangeTournament }: { tournamentId: string; onChangeTournament: () => void }) {
  const {
    isAdmin, previewAsUser, setPreviewAsUser, adminName,
    players, roster, loading, resetAll,
    spinQueue, spinItemCategory,
    tickerText, setTickerText,
    ffa, sseStatus, visitorCount, activeAdminCount,
  } = useTourney();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // matchKey of the card that should glow in the Match Info tab
  const [highlightMatchKey, setHighlightMatchKey] = useState<string | null>(null);

  const filteredSpinResults = activeCategory
    ? spinQueue.filter((_, i) => spinItemCategory[i] === activeCategory)
    : spinQueue;

  const [activeTab, setActiveTab] = useState<TabId>('players');
  const [adminOpen, setAdminOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [tickerEditOpen, setTickerEditOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored === 'true') setDark(true);
  }, []);

  const toggleDark = () => setDark(prev => {
    localStorage.setItem('darkMode', String(!prev));
    return !prev;
  });

  const handleReset = async () => {
    if (!resetConfirm) { setResetConfirm(true); setTimeout(() => setResetConfirm(false), 3000); return; }
    await resetAll();
    setResetConfirm(false);
  };

  // Bracket card clicked → switch to Match Info tab and glow the right card
  const handleMatchCardClick = (matchKey: string) => {
    setHighlightMatchKey(matchKey);
    setActiveTab('caster');
  };

  const isActuallyAdmin = isAdmin || previewAsUser;

  if (loading) {
    return (
      <div className={`${dark ? 'dark' : ''} h-screen w-screen flex items-center justify-center t-bg`}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 font-['Bebas_Neue'] text-5xl tracking-widest bg-gradient-to-r from-[var(--accent-red)] to-[var(--accent)] bg-clip-text text-transparent mb-4">
            <img src="/launcher-icon.png" alt="" className="w-12 h-12 object-contain" />
            TOURNEY
          </div>
          <div className="font-['DM_Mono'] text-xs t-muted animate-pulse">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${dark ? 'dark' : ''} t-bg h-screen overflow-hidden flex flex-col`}>
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 20% 10%, var(--grad-start) 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 80% 90%, var(--grad-end) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col h-full min-h-0">
        {/* Header */}
        <header className="t-header backdrop-blur-md border-b t-border shrink-0 z-40">
          <div className="w-full px-8 py-3 flex items-center justify-between">
            <button
              onClick={onChangeTournament}
              className="flex items-center gap-2 font-['Bebas_Neue'] text-2xl tracking-widest bg-gradient-to-r from-[var(--accent-red)] to-[var(--accent)] bg-clip-text text-transparent hover:opacity-75 transition-opacity cursor-pointer"
              title="Switch tournament"
            >
              <img src="/launcher-icon.png" alt="" className="w-6 h-6 object-contain" />
              TOURNEY
            </button>
            <div className="flex items-center gap-2">
              <span className="font-['DM_Mono'] text-[10px] t-muted border t-border-mid rounded px-2 py-1 uppercase tracking-widest hidden sm:inline">
                {tournamentId}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 font-['DM_Mono'] text-[10px] t-muted border t-border-mid rounded px-2 py-1">
                👁 {visitorCount} visitor{visitorCount !== 1 ? 's' : ''} | 🛡 {activeAdminCount} admin{activeAdminCount !== 1 ? 's' : ''}
              </span>
              <span
                className="hidden sm:inline-flex items-center gap-1 font-['DM_Mono'] text-[10px] px-2 py-1 rounded border"
                style={{
                  color: sseStatus === 'connected' ? 'var(--accent-green)' : sseStatus === 'polling' ? 'var(--accent-gold)' : sseStatus === 'error' ? 'var(--accent-red)' : 'var(--text-muted)',
                  borderColor: sseStatus === 'connected' ? 'rgba(34,184,98,0.3)' : sseStatus === 'polling' ? 'rgba(224,144,16,0.3)' : sseStatus === 'error' ? 'rgba(232,41,74,0.3)' : 'var(--border-mid)',
                  background: sseStatus === 'connected' ? 'rgba(34,184,98,0.06)' : sseStatus === 'polling' ? 'rgba(224,144,16,0.06)' : sseStatus === 'error' ? 'rgba(232,41,74,0.06)' : 'transparent',
                }}
                title={sseStatus === 'connected' ? 'Live updates active' : sseStatus === 'polling' ? 'Polling for updates' : sseStatus === 'error' ? 'Connection lost — retrying' : 'Connecting…'}
              >
                <span style={{ fontSize: 7 }}>{sseStatus === 'connected' ? '●' : sseStatus === 'polling' ? '◎' : sseStatus === 'error' ? '●' : '○'}</span>
                {sseStatus === 'connected' ? 'Live' : sseStatus === 'polling' ? 'Polling' : sseStatus === 'error' ? 'Offline' : 'Connecting'}
              </span>
              <button
                onClick={toggleDark}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border t-border-mid t-muted t-elevated font-['DM_Mono'] text-xs transition-all hover:border-[var(--border)] hover:t-text cursor-pointer"
              >
                {dark ? '☀️ Light' : '🌙 Dark'}
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => setTickerEditOpen(true)}
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
              {isActuallyAdmin ? (
                <button
                  onClick={() => setPreviewAsUser(!previewAsUser)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-['DM_Mono'] text-xs transition-all cursor-pointer ${
                    previewAsUser
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(77,124,255,0.06)]'
                      : 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[rgba(255,176,32,0.1)]'
                  }`}
                  title={previewAsUser ? 'Switch back to admin view' : 'Preview as regular user'}
                >
                  <span>{previewAsUser ? '👁' : '🔓'}</span>
                  <span>{previewAsUser ? 'Preview (tap to exit)' : `${adminName ?? 'Admin'} ✓`}</span>
                </button>
              ) : (
                <button
                  onClick={() => setAdminOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border t-border-mid t-muted t-elevated font-['DM_Mono'] text-xs transition-all hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] cursor-pointer"
                  title="Log in as admin for this tournament"
                >
                  🔒 Admin
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Tab nav */}
        <nav className="t-surface border-b t-border shrink-0 relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:hidden" style={{ background: 'linear-gradient(to left, var(--bg-surface), transparent)', zIndex: 1 }} />
          <div className="w-full px-8 flex overflow-x-auto scrollbar-none">
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
                {tab.id === 'ffa' && (ffa.matches?.length ?? 0) > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent-red)] text-white text-[9px] font-bold">
                    {ffa.matches.length}
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
            <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'bracket' ? '' : 'hidden'}`}>
              <BracketTab
                spinResults={filteredSpinResults}
                onMatchCardClick={handleMatchCardClick}
              />
            </div>
            <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'caster'  ? '' : 'hidden'}`}>
              <CasterSheetTab
                highlightMatchKey={highlightMatchKey}
                onHighlightHandled={() => setHighlightMatchKey(null)}
              />
            </div>
            <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'maps'    ? '' : 'hidden'}`}><MapsTab activeCategory={activeCategory} setActiveCategory={setActiveCategory} /></div>
            <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'ffa'     ? '' : 'hidden'}`}><FFATab /></div>
          </div>
        </main>

        <BottomTicker text={tickerText} />
      </div>

      <AdminModal open={adminOpen} onClose={() => setAdminOpen(false)} />
      <ChatPanel open={chatOpen} onToggle={() => setChatOpen(o => !o)} />

      <TickerEditModal
        open={tickerEditOpen}
        tickerText={tickerText}
        onClose={() => setTickerEditOpen(false)}
        onSave={async (text) => { await setTickerText(text); setTickerEditOpen(false); }}
      />
    </div>
  );
}
MainApp.displayName = 'MainApp';

// ─── Root page — manages picker → provider → app ──────────────────────────────
export default function Home() {
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const session = useAdminSession();

  useEffect(() => {
    const saved = localStorage.getItem('lastTournamentId');
    if (saved) setTournamentId(saved);
  }, []);

  const handleSelect = (id: string, adminToken?: string, adminInfo?: { adminId: string; name: string; isSuperAdmin: boolean }) => {
    localStorage.setItem('lastTournamentId', id);
    if (adminToken && adminInfo) {
      localStorage.setItem('adminToken', adminToken);
      localStorage.setItem('adminInfo', JSON.stringify(adminInfo));
    }
    setTournamentId(id);
  };

  const handleChangeTournament = () => {
    localStorage.removeItem('lastTournamentId');
    setTournamentId(null);
  };

  if (!tournamentId) {
    return <TournamentPicker onSelect={handleSelect} />;
  }

  return (
    <TourneyProvider
      tournamentId={tournamentId}
      initialAdminToken={session.adminToken ?? undefined}
      initialAdminInfo={session.adminInfo}
    >
      <MainApp tournamentId={tournamentId} onChangeTournament={handleChangeTournament} />
    </TourneyProvider>
  );
}
