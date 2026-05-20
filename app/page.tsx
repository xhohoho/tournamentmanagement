'use client';

import { useState } from 'react';
import { useTourney } from '@/lib/context';
import { AdminModal } from '@/components/AdminModal';
import { PlayersTab } from '@/components/PlayersTab';
import { TeamsTab } from '@/components/TeamsTab';
import { BracketTab } from '@/components/BracketTab';
import { MapsTab } from '@/components/MapsTab';
import type { TabId } from '@/lib/types';
import Head from 'next/head';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'players', icon: '👥', label: 'Players' },
  { id: 'teams', icon: '🛡', label: 'Teams' },
  { id: 'bracket', icon: '🏆', label: 'Bracket' },
  { id: 'maps', icon: '🗺', label: 'Maps' },
];

export default function Home() {
  const { isAdmin, setIsAdmin, players, loading } = useTourney();
  const [activeTab, setActiveTab] = useState<TabId>('players');
  const [adminOpen, setAdminOpen] = useState(false);

  const handleAdminBtn = () => {
    if (isAdmin) { setIsAdmin(false); return; }
    setAdminOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="text-center">
          <div className="font-['Bebas_Neue'] text-5xl tracking-widest bg-gradient-to-r from-[#ff3d5a] to-[#4d7cff] bg-clip-text text-transparent mb-4">
            ⚔ TOURNEY
          </div>
          <div className="font-['DM_Mono'] text-xs text-[#7878a0] animate-pulse">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </Head>
      <div className="relative min-h-screen">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_20%_10%,rgba(77,124,255,0.07)_0%,transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_90%,rgba(255,61,90,0.06)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="flex items-center justify-between px-6 py-[14px] bg-[rgba(15,15,26,0.9)] border-b border-[#252538] backdrop-blur-md sticky top-0 z-40">
          <div className="font-['Bebas_Neue'] text-3xl tracking-widest bg-gradient-to-r from-[#ff3d5a] to-[#4d7cff] bg-clip-text text-transparent">
            ⚔ TOURNEY
          </div>
          <button
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border font-['DM_Mono'] text-xs transition-all cursor-pointer ${isAdmin ? 'border-[#ffb020] text-[#ffb020] bg-[rgba(255,176,32,0.1)]' : 'border-[#32324a] text-[#7878a0] bg-[#161625] hover:border-[#ffb020] hover:text-[#ffb020]'}`}
            onClick={handleAdminBtn}
          >
            <span>{isAdmin ? '🔓' : '🔒'}</span>
            <span>{isAdmin ? 'Admin ✓' : 'Admin'}</span>
          </button>
        </header>

        <nav className="flex flex-col md:flex-row bg-[#0f0f1a] border-b border-[#252538] overflow-x-auto px-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-4 py-3 md:px-5 md:py-3.5 font-['DM_Mono'] text-xs tracking-widest uppercase border-b-2 transition-all whitespace-nowrap w-full md:w-auto cursor-pointer ${activeTab === tab.id ? 'border-[#4d7cff] text-[#4d7cff] bg-[rgba(77,124,255,0.06)]' : 'border-transparent text-[#7878a0] hover:text-[#dde0f0] hover:bg-[rgba(255,255,255,0.03)]'}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
              {tab.id === 'players' && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#ff3d5a] text-white text-[9px] font-bold ml-1">
                  {players.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <main className="flex-1">
          <div className={activeTab === 'players' ? 'block' : 'hidden'}><PlayersTab /></div>
          <div className={activeTab === 'teams' ? 'block' : 'hidden'}><TeamsTab /></div>
          <div className={activeTab === 'bracket' ? 'block' : 'hidden'}><BracketTab /></div>
          <div className={activeTab === 'maps' ? 'block' : 'hidden'}><MapsTab /></div>
        </main>
      </div>

      <AdminModal open={adminOpen} onClose={() => setAdminOpen(false)} />
    </div>
  </>
);
}
