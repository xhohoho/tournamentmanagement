'use client';

import { useState } from 'react';
import { useTourney } from '@/lib/context';
import { AdminModal } from '@/components/AdminModal';
import { PlayersTab } from '@/components/PlayersTab';
import { TeamsTab } from '@/components/TeamsTab';
import { BracketTab } from '@/components/BracketTab';
import { MapsTab } from '@/components/MapsTab';
import type { TabId } from '@/lib/types';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'players', icon: '👥', label: 'Players' },
  { id: 'teams',   icon: '🛡',  label: 'Teams'   },
  { id: 'bracket', icon: '🏆', label: 'Bracket'  },
  { id: 'maps',    icon: '🗺',  label: 'Maps'     },
];

export default function Home() {
  const { isAdmin, setIsAdmin, players, loading } = useTourney();
  const [activeTab, setActiveTab] = useState<TabId>('players');
  const [adminOpen, setAdminOpen] = useState(false);
  const [dark, setDark] = useState(false);

  const handleAdminBtn = () => {
    if (isAdmin) { setIsAdmin(false); return; }
    setAdminOpen(true);
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
    <div className={`${dark ? 'dark' : ''} t-bg`}>
      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 20% 10%, var(--grad-start) 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 80% 90%, var(--grad-end) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">

        {/* Header */}
        <header className="t-header backdrop-blur-md border-b t-border sticky top-0 z-40">
          <div className="w-full px-8 py-3 flex items-center justify-between">
            <div className="font-['Bebas_Neue'] text-2xl tracking-widest bg-gradient-to-r from-[var(--accent-red)] to-[var(--accent)] bg-clip-text text-transparent">
              ⚔ TOURNEY
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDark(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border t-border-mid t-muted t-elevated font-['DM_Mono'] text-xs transition-all hover:border-[var(--border)] hover:t-text cursor-pointer"
              >
                {dark ? '☀️ Light' : '🌙 Dark'}
              </button>
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
                className={`flex items-center gap-2 px-5 py-3.5 font-['DM_Mono'] text-xs tracking-widest uppercase border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(77,124,255,0.06)]'
                    : 'border-transparent t-muted hover:t-text hover:bg-[rgba(128,128,255,0.04)]'
                }`}
              >
                {tab.icon} {tab.label}
                {tab.id === 'players' && players.length > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent-red)] text-white text-[9px] font-bold">
                    {players.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Content — each tab fills the remaining viewport height */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col w-full px-8">
            <div className={`flex-1 flex flex-col ${activeTab === 'players' ? '' : 'hidden'}`}><PlayersTab /></div>
            <div className={`flex-1 flex flex-col ${activeTab === 'teams'   ? '' : 'hidden'}`}><TeamsTab   /></div>
            <div className={`flex-1 flex flex-col ${activeTab === 'bracket' ? '' : 'hidden'}`}><BracketTab /></div>
            <div className={`flex-1 flex flex-col ${activeTab === 'maps'    ? '' : 'hidden'}`}><MapsTab    /></div>
          </div>
        </main>
      </div>

      <AdminModal open={adminOpen} onClose={() => setAdminOpen(false)} />
    </div>
  );
}
