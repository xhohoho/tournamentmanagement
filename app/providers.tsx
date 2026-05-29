'use client';

import { TourneyProvider } from '@/lib/context';

export function Providers({ children }: { children: React.ReactNode }) {
  return <TourneyProvider>{children}</TourneyProvider>;
}
