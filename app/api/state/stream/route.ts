import { NextRequest } from 'next/server';
import { getState, safeState } from '@/lib/kv';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

const PUSH_INTERVAL_MS = 1500;
const KEEPALIVE_MS = 25_000;

function hashState(s: ReturnType<typeof safeState>): string {
  return createHash('md5').update(JSON.stringify(s)).digest('hex');
}

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  let closed = false;
  let pushInterval: ReturnType<typeof setInterval> | null = null;
  let kaInterval: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (pushInterval) { clearInterval(pushInterval); pushInterval = null; }
    if (kaInterval)   { clearInterval(kaInterval);   kaInterval = null;   }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let lastHash = '';

      const send = (data: string) => {
        if (closed) return;
        controller.enqueue(enc.encode(`data: ${data}\n\n`));
      };

      const keepalive = () => {
        if (closed) return;
        controller.enqueue(enc.encode(': keepalive\n\n'));
      };

      const pushIfChanged = async () => {
        if (closed) return;
        try {
          const state = await getState(tid);
          const safe = safeState(state);
          const hash = hashState(safe);
          if (hash !== lastHash) {
            lastHash = hash;
            send(JSON.stringify(safe));
          }
        } catch { /* ignore */ }
      };

      // Send initial state immediately.
      await pushIfChanged();

      pushInterval = setInterval(pushIfChanged, PUSH_INTERVAL_MS);
      kaInterval   = setInterval(keepalive,      KEEPALIVE_MS);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
