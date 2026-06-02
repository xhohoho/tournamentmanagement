import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS middleware for all /api/* routes.
 *
 * Allowed origins:
 *  - null origin (same-site / non-browser) — always passes
 *  - Any origins listed in ALLOWED_ORIGINS env var (comma-separated)
 *
 * Set ALLOWED_ORIGINS in Vercel (or .env.local) to permit cross-origin
 * clients such as a separate spectator frontend or Electron wrapper:
 *   ALLOWED_ORIGINS=https://spectator.example.com,https://admin.example.com
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Token',
  'Access-Control-Max-Age': '86400', // 24 h preflight cache
} as const;

function getAllowedOrigins(): Set<string> {
  const raw = process.env.ALLOWED_ORIGINS ?? '';
  return new Set(raw.split(',').map(o => o.trim()).filter(Boolean));
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');

  const allowed = getAllowedOrigins();

  // null origin = same-site / non-browser — always allowed
  const isAllowed = !origin || allowed.has(origin);

  // OPTIONS preflight — respond immediately without hitting the route handler
  if (req.method === 'OPTIONS') {
    if (!isAllowed) return new NextResponse(null, { status: 403 });
    const res = new NextResponse(null, { status: 204 });
    if (origin) res.headers.set('Access-Control-Allow-Origin', origin);
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    res.headers.set('Vary', 'Origin');
    return res;
  }

  // All other methods: pass through, attach CORS headers to response
  const res = NextResponse.next();
  if (isAllowed && origin) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    res.headers.set('Vary', 'Origin');
  }
  return res;
}

export const config = {
  // Only run middleware on API routes
  matcher: '/api/:path*',
};
