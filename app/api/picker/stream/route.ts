import { NextRequest } from 'next/server';
import { kv } from '@vercel/kv';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

const KEEPALIVE_MS = 25_000;
const ACTIVE_ADMINS_KEY = 'tournament:activeAdmins';

// ─── Per-tournament SSE client sets ──────────────────────────────────────────
interface PickerClient {
  controller: ReadableStreamDefaultController;
  visitorKey: string;
}
const pickerClients = new Map<string, Map<string, PickerClient>>();

// ─── Broadcast to all picker SSE clients for a tournament ────────────────────
function broadcast(tid: string, data: object) {
  const clients = pickerClients.get(tid);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(payload);
  for (const client of clients.values()) {
    try {
      client.controller.enqueue(encoded);
    } catch {
      // Client disconnected
    }
  }
}

// ─── Get current stats ───────────────────────────────────────────────────────
async function getStats(tid: string): Promise<{ visitorCount: number; activeAdminCount: number }> {
  const clients = pickerClients.get(tid);
  const visitorCount = clients?.size ?? 0;
  try {
    const admins = await kv.get<string[]>(ACTIVE_ADMINS_KEY);
    return { visitorCount, activeAdminCount: admins?.length ?? 0 };
  } catch {
    return { visitorCount, activeAdminCount: 0 };
  }
}

// ─── Register / unregister admin ──────────────────────────────────────────────
export async function registerAdmin(adminId: string) {
  try {
    const current = await kv.get<string[]>(ACTIVE_ADMINS_KEY) ?? [];
    if (!current.includes(adminId)) {
      await kv.set(ACTIVE_ADMINS_KEY, [...current, adminId]);
    }
  } catch { /* ignore */ }
  // Broadcast to all connected picker streams
  for (const tid of pickerClients.keys()) {
    const stats = await getStats(tid);
    broadcast(tid, stats);
  }
}

export async function unregisterAdmin(adminId: string) {
  try {
    const current = await kv.get<string[]>(ACTIVE_ADMINS_KEY) ?? [];
    await kv.set(ACTIVE_ADMINS_KEY, current.filter(id => id !== adminId));
  } catch { /* ignore */ }
  for (const tid of pickerClients.keys()) {
    const stats = await getStats(tid);
    broadcast(tid, stats);
  }
}

// ─── SSE endpoint ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'picker';

  const visitorKey = createHash('sha1')
    .update(`${req.headers.get('x-forwarded-for') ?? 'unknown'}|${req.headers.get('user-agent') ?? 'unknown'}`)
    .digest('hex');

  let closed = false;
  let kaInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      // Dedupe: if same visitor key already connected, close the old one first
      if (!pickerClients.has(tid)) pickerClients.set(tid, new Map());
      const clients = pickerClients.get(tid)!;

      const oldClient = clients.get(visitorKey);
      if (oldClient) {
        // Close the previous connection from this same visitor
        try { oldClient.controller.close(); } catch { /* already closed */ }
        clients.delete(visitorKey);
        // Don't broadcast here — the new connection will send correct count
      }

      // Register new client
      const client: PickerClient = { controller, visitorKey };
      clients.set(visitorKey, client);

      // Send current stats (after registering so count includes this visitor)
      const stats = await getStats(tid);
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(stats)}\n\n`));

      // Keepalive
      kaInterval = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(new TextEncoder().encode(': keepalive\n\n')); } catch { /* closed */ }
      }, KEEPALIVE_MS);
    },
    cancel() {
      if (closed) return;
      closed = true;
      if (kaInterval) clearInterval(kaInterval);
      // Remove this client
      const clients = pickerClients.get(tid);
      if (clients) {
        clients.delete(visitorKey);
        if (clients.size === 0) pickerClients.delete(tid);
      }
      // Broadcast updated visitor count after disconnect
      getStats(tid).then(stats => broadcast(tid, stats)).catch(() => {});
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
