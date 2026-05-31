import { NextRequest } from 'next/server';
import { listTournaments } from '@/lib/kv';

export const runtime = 'nodejs';

const PUSH_INTERVAL_MS = 3000;
const KEEPALIVE_MS = 25_000;

export async function GET(_req: NextRequest) {
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

      // Send initial list immediately
      try {
        const tournaments = await listTournaments();
        send(JSON.stringify({ tournaments }));
      } catch { /* ignore */ }

      const pushInterval = setInterval(async () => {
        if (closed) { clearInterval(pushInterval); return; }
        try {
          const tournaments = await listTournaments();
          send(JSON.stringify({ tournaments }));
        } catch { /* ignore */ }
      }, PUSH_INTERVAL_MS);

      const kaInterval = setInterval(keepalive, KEEPALIVE_MS);

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
      'X-Accel-Buffering': 'no',
    },
  });
}
