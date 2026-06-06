import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { getActiveAdminCount } from '@/lib/kv';

export const runtime = 'nodejs';

const KEEPALIVE_MS = 25_000;

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

// ─── Build and broadcast current counts to all clients for a tournament ──────
async function broadcastCounts(tid: string) {
  const visitorCount = pickerClients.get(tid)?.size ?? 0;
  const activeAdminCount = await getActiveAdminCount();
  broadcast(tid, { visitorCount, activeAdminCount });
}

// ─── SSE endpoint ─────────────────────────────────────────────────────────────
// GET /api/picker/stream?t={tournamentId}
// Tracks visitor count via SSE connections and activeAdminCount from KV.
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
        try { oldClient.controller.close(); } catch { /* already closed */ }
        clients.delete(visitorKey);
      }

      // Register new client
      const client: PickerClient = { controller, visitorKey };
      clients.set(visitorKey, client);

      // Send current counts (visitor + admin) immediately after registering
      const activeAdminCount = await getActiveAdminCount();
      const visitorCount = clients.size;
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ visitorCount, activeAdminCount })}\n\n`));

      // Broadcast updated counts to all other connected clients
      broadcastCounts(tid).catch(() => {});

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
      // Broadcast updated counts to remaining clients
      broadcastCounts(tid).catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Ael-Buffering': 'no',
    },
  });
}
