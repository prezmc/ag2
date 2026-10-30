import { NextRequest, NextResponse } from 'next/server';

/**
 * Request checks for /api/*.
 *
 * 1. Cross-site protection (always on). Requests that change data (POST, PUT,
 *    DELETE, …) are refused when a browser marks them as coming from another
 *    site, and must send Content-Type: application/json. Without this, any web
 *    page you visit could quietly send a request to AG2 on your network and add
 *    a monitor (CSRF).
 *
 * 2. Optional API key (set AG2_API_KEY to enable). Requests from AG2's own
 *    pages are allowed without a key. Everything else (scripts, other apps)
 *    must send an X-API-Key header.
 *
 * A non-browser client can forge the browser headers used to recognize AG2's
 * own pages, so the API key is not a login for the dashboard. If AG2 is
 * reachable from the internet, put real authentication in front of it.
 */
const PUBLIC_ROUTES = ['/api/health'];
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Definitely a request from AG2's own pages (browser-set headers). */
function isSameOrigin(request: NextRequest): boolean {
  if (request.headers.get('sec-fetch-site') === 'same-origin') return true;
  const host = request.headers.get('host');
  const origin = hostOf(request.headers.get('origin'));
  return !!host && origin === host;
}

/** Definitely a request a browser sent on behalf of a different site. */
function isCrossSite(request: NextRequest): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site' || site === 'same-site') return true;
  const originHeader = request.headers.get('origin');
  if (originHeader === 'null') return true; // sandboxed iframes, file:// pages
  const origin = hostOf(originHeader);
  const host = request.headers.get('host');
  return !!origin && !!host && origin !== host;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // ── 1. CSRF protection for anything that changes data ──
  if (!SAFE_METHODS.has(method)) {
    if (isCrossSite(request)) {
      return NextResponse.json({ error: 'Cross-site requests are not allowed' }, { status: 403 });
    }
    const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
    const type = request.headers.get('content-type')?.toLowerCase() ?? '';
    if (hasBody && !type.startsWith('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }
  }

  // ── 2. Optional API key ──
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
