import { NextRequest, NextResponse } from 'next/server';
import authMiddleware from 'next-auth/middleware';
import type { NextRequestWithAuth } from 'next-auth/middleware';

const productionHost = 'outbox-mail-scheduler.vercel.app';

export default function middleware(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl;
  const isOAuthOrAuthenticatedPage =
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/');

  if (
    process.env.VERCEL_ENV &&
    process.env.VERCEL_ENV !== 'development' &&
    hostname !== productionHost &&
    isOAuthOrAuthenticatedPage
  ) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = 'https:';
    canonicalUrl.hostname = productionHost;
    canonicalUrl.port = '';
    return NextResponse.redirect(canonicalUrl, 308);
  }

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return authMiddleware(request as NextRequestWithAuth);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/api/auth/:path*', '/dashboard/:path*'],
};
