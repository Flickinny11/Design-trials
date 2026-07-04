'use client';

// PRISM SHELL — AUTH CLIENT (SHELL W1A, spec I2)
//
// The client half of the ONE auth system: Better Auth's React client against
// the /api/auth mount. Session state lives in Better Auth's own hook (it is
// auth plumbing, not app state — I3's "Zustand for shared state" governs app
// concerns; sessions belong to the auth system).
//
// No secrets here ever (I5): the client sees only the httpOnly-cookie
// session and public profile fields.

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
