'use client';

import { TourneyProvider } from '@/lib/context';

export function Providers({ children, tournamentId }: { children: React.ReactNode; tournamentId?: string }) {
  return <TourneyProvider tournamentId={tournamentId}>{children}</TourneyProvider>;
}
