'use client';

import { useState, useEffect, useCallback } from 'react';

const DEFAULT_TEXT =
  '⚡ SUDDEN ATTACK SHOP NOW OPEN — Grab your gear at suddenattack.safie.cc — Exclusive deals on weapons, skins & more! 🛒 Click here to visit the shop!';

export function usePickerTicker(adminToken: string | null) {
  const [tickerText, setTickerText] = useState(DEFAULT_TEXT);

  // Fetch on mount
  useEffect(() => {
    fetch('/api/picker-ticker')
      .then(r => r.json())
      .then(d => { if (d.tickerText) setTickerText(d.tickerText); })
      .catch(() => {});
  }, []);

  // Save — super admin only (enforced server-side too)
  const saveTickerText = useCallback(async (text: string): Promise<{ error?: string }> => {
    if (!adminToken) return { error: 'Not logged in.' };
    try {
      const res  = await fetch('/api/picker-ticker', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
        body:    JSON.stringify({ tickerText: text }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error ?? 'Failed to save.' };
      setTickerText(data.tickerText);
      return {};
    } catch {
      return { error: 'Network error.' };
    }
  }, [adminToken]);

  return { tickerText, saveTickerText };
}
