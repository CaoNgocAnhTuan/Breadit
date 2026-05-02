import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/verify', '/forgot-password', '/reset'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.cookies.get('breadit_session')) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|uploads|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)',
  ],
};
