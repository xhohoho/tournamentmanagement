import { getState } from '@/lib/kv';

// Vercel Fluid / Edge-compatible SSE endpoint.
// Clients connect here instead of polling /api/state every 4 s.
// The server pushes a "data: ..." frame whenever state changes, plus a
// keepalive comment every 25 s so proxies don't close the connection.
//
// Fallback: context.tsx automatically falls back to 4 s polling when this
// endpoint returns an error or is unreachable.

export const runtime = 'nodejs';

// How often to poll KV internally and push to connected clients (ms).
const PUSH_INTERVAL_MS = 1500;
// How often to send a keepalive comment to keep the connection alive (ms).
const KEEPALIVE_MS = 25_000;

export async function GET() {
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      const send = (data: string) => {
        if (closed) return;
        controller.enqueue(enc.encode(`data: ${data}\n\n`));
      };

      const keepalive = () => {
        if (closed) return;
        controller.enqueue(enc.encode(': keepalive\n\n'));
      };

      // Initial push
      try {
        const state = await getState();
        const { adminPwHash: _, ...safe } = state;
        send(JSON.stringify(safe));
      } catch { /* ignore */ }

      const pushInterval = setInterval(async () => {
        if (closed) { clearInterval(pushInterval); return; }
        try {
          const state = await getState();
          const { adminPwHash: _, ...safe } = state;
          send(JSON.stringify(safe));
        } catch { /* ignore — client will retry on onerror */ }
      }, PUSH_INTERVAL_MS);

      const kaInterval = setInterval(keepalive, KEEPALIVE_MS);

      // Clean up when the client disconnects
      return () => {
        closed = true;
        clearInterval(pushInterval);
        clearInterval(kaInterval);
      };
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}
