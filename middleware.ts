import { NextRequest, NextResponse } from 'next/server';

/**
 * Optional API key protection for /api/* (set AG2_API_KEY to enable).
 *
 * - Requests from this app's own pages are allowed without a key. They are
 *   recognized by the browser-set Sec-Fetch-Site: same-origin header, or an
 *   Origin whose host exactly matches the Host header.
 * - Everything else (scripts, other sites, other apps) must send X-API-Key.
 *
 * Note: a non-browser client can forge those headers, so the key keeps other
 * websites from using your API through a visitor's browser; it is not a login
 * for the dashboard. If AG2 is reachable from the internet, put real auth
 * (e.g. Cloudflare Access) in front of it.
 */
const PUBLIC_ROUTES = ['/api/health'];

function isSameOrigin(request: NextRequest): boolean {
  if (request.headers.get('sec-fetch-site') === 'same-origin') return true;
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(`${r}/`))) {
    return NextResponse.next();
  }

  const apiKey = process.env.AG2_API_KEY;
  if (!apiKey) return NextResponse.next();

  if (isSameOrigin(request)) return NextResponse.next();

  const provided = request.headers.get('x-api-key');
  if (provided && safeEqual(provided, apiKey)) return NextResponse.next();

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export const config = {
  matcher: '/api/:path*',
};
