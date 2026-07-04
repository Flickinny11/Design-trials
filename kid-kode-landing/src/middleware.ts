// PRISM SHELL — /app/* ROUTE GUARD, EDGE LAYER (SHELL W1A, spec §14 W1A)
//
// Fast OPTIMISTIC check: a request into /app/* without a Better Auth session
// cookie is redirected to the premium sign-in before any app code runs. This
// is UX-speed only, not the security boundary — the cookie's validity is
// verified server-side in src/app/app/layout.tsx (real getSession) and at
// every data edge (protectedProcedure / guarded asset routes). Defense in
// depth: middleware saves the round-trip; the layers below fail closed.
//
// Scope: ONLY /app/*. The canvas editor at `/` and every existing lab route
// stay untouched (FP7).

import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const cookie = getSessionCookie(request);
  if (!cookie) {
    const signIn = new URL('/sign-in', request.url);
    const next = request.nextUrl.pathname + request.nextUrl.search;
    signIn.searchParams.set('next', next);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
