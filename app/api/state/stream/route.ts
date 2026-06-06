import { NextRequest } from 'next/server';
import { getState, safeState, updateState } from '@/lib/kv';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

const PUSH_INTERVAL_MS = 1500;
const KEEPALIVE_MS = 25_000;

function hashState(s: ReturnType<typeof safeState>): string {
  return createHash('md5').update(JSON.stringify(s)).digest('hex');
}

// ─── In-memory connection tracking ─────────────────────────────────────────────
// Per-tournament sets of connection keys (hashed IP+UA).
const connections = new Map<string, Set<string>>();

function connectionKey(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const ua = req.headers.get('user-agent') ?? 'unknown';
  return createHash('sha1').update(`${ip}|${ua}`).digest('hex');
}

// Store connection key on the cleanup function so cancel() can access it.
type CleanupFn = () => void;
interface CleanupWithKey extends CleanupFn {
  _connKey?: string;
}

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  let closed = false;
  let pushInterval: ReturnType<typeof setInterval> | null = null;
  let kaInterval: ReturnType<typeof setInterval> | null = null;

  // Register connection for visitor counting
  const cKey = connectionKey(req);
  if (!connections.has(tid)) connections.set(tid, new Set());
  connections.get(tid)!.add(cKey);
  // Immediately push new visitor count
  updateState(
    (s) => ({ ...s, visitorCount: connections.get(tid)?.size ?? 0 }),
    tid,
  ).catch(() => {});

  const cleanup: CleanupWithKey = () => {
    if (closed) return;
    closed = true;
    if (pushInterval) { clearInterval(pushInterval); pushInterval = null; }
    if (kaInterval)   { clearInterval(kaInterval);   kaInterval = null;   }

    // Remove this connection and update visitor count
    const key = cleanup._connKey;
    if (key) {
      const set = connections.get(tid);
      if (set) {
        set.delete(key);
        if (set.size === 0) connections.delete(tid);
      }
      // Update KV visitor count
      updateState(
        (s) => ({ ...s, visitorCount: (connections.get(tid)?.size ?? 0) }),
        tid,
      ).catch(() => {});
    }
  };
  cleanup._connKey = cKey;

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
