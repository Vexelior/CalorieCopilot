import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'cc_session';

/**
 * Fast gate: bounce requests without a session cookie before rendering.
 * Pages still validate the session against the database (lib/auth.ts).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?returnUrl=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Must be static: protected pages and the API.
  matcher: ['/diary/:path*', '/scan/:path*', '/analytics/:path*', '/profile/:path*', '/api/:path*'],
};
