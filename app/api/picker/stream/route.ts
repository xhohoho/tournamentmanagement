import { NextRequest } from 'next/server';
import { createHash } from 'crypto';

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

// ─── SSE endpoint ────────────────────────────────────────────────────────────
// GET /api/picker/stream?t={tournamentId}
// Tracks visitor count via SSE connections. Admin count is tracked locally
// in the TournamentPicker component via login/logout events.
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

      // Send current visitor count (after registering so count includes this visitor)
      const visitorCount = clients.size;
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ visitorCount })}\n\n`));

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
      // Broadcast updated visitor count
      const visitorCount = clients?.size ?? 0;
      broadcast(tid, { visitorCount });
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
