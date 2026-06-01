'use client';

import { useEffect, useRef } from 'react';

/**
 * Generic SSE hook with polling fallback.
 *
 * Connects to `url` via EventSource and calls `onData` for each message.
 * Falls back to `fetch(url)` polling at `pollInterval` ms if EventSource
 * is unavailable or encounters an error.
 *
 * @param url           The SSE endpoint URL (or regular JSON endpoint for polling).
 * @param onData        Callback invoked with the parsed JSON payload on each event.
 * @param pollInterval  Milliseconds between poll retries (default 4000).
 * @param deps          Extra dependency array values that should trigger reconnection.
 */
export function useSSE<T>(
  url: string,
  onData: (data: T) => void,
  pollInterval = 4000,
  deps: unknown[] = [],
): void {
  // Keep a stable ref to onData so the effect doesn't re-run when the callback changes.
  const onDataRef = useRef(onData);
  useEffect(() => { onDataRef.current = onData; });

  useEffect(() => {
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const fetchOnce = async () => {
      try {
        const res = await fetch(url);
        const data = await res.json();
        onDataRef.current(data as T);
      } catch { /* silently ignore network blip */ }
    };

    const connect = () => {
      if (typeof EventSource === 'undefined') {
        fetchOnce();
        pollTimer = setInterval(fetchOnce, pollInterval);
        return;
      }
      es = new EventSource(url);
      es.onmessage = (e) => {
        try { onDataRef.current(JSON.parse(e.data) as T); } catch { /* ignore malformed frame */ }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        if (!pollTimer) {
          fetchOnce();
          pollTimer = setInterval(fetchOnce, pollInterval);
        }
      };
    };

    connect();
    return () => {
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, pollInterval, ...deps]);
}
