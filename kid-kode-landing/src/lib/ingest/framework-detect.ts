// PRISM INGEST — framework detection (W-IMPORT, D9).
//
// v1 fully supports Next.js (App Router + Pages Router) and generic React.
// Anything else is `unknown` and degrades honestly — the import falls back to a
// prompt-seeded guided build (I-FAILOPEN / I-HONEST-FIDELITY), never a dead end.
// Conventions verified against Next.js 2026 docs (App Router first: app/**/page,
// route.ts handlers, 'use client' boundary, Server Actions for forms).

import type { IngestFramework } from '../../../packages/shared-interfaces/src/prism-ingest';

export interface PackageInfo {
  name: string | null;
  description: string | null;
  deps: Record<string, string>;
}

export interface FrameworkDetection {
  framework: IngestFramework;
  supported: boolean;
  note: string;
  hasAppRouter: boolean;
  hasPagesRouter: boolean;
}

// App Router route file: an `app/` segment ending in page|route|layout (src/app too).
const APP_ROUTE_RE = /(?:^|\/)app\/(?:.*\/)?(page|route|layout|template|default)\.(tsx|ts|jsx|js|mjs)$/;
// Pages Router page: a `pages/` file, excluding pages/api and the _app/_document specials.
const PAGES_PAGE_RE = /(?:^|\/)pages\/(?!api\/)(?!_)(?:.*\/)?[^/]+\.(tsx|ts|jsx|js|mjs)$/;

export function parsePackageJson(text: string | null): PackageInfo {
  if (!text) return { name: null, description: null, deps: {} };
  try {
    const j = JSON.parse(text) as {
      name?: string;
      description?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    return {
      name: j.name ?? null,
      description: j.description ?? null,
      deps: { ...j.peerDependencies, ...j.devDependencies, ...j.dependencies },
    };
  } catch {
    return { name: null, description: null, deps: {} };
  }
}

export function detectFramework(files: string[], pkg: PackageInfo): FrameworkDetection {
  const hasNext = 'next' in pkg.deps;
  const hasReact = 'react' in pkg.deps || 'react-dom' in pkg.deps;
  const hasAppRouter = files.some((f) => APP_ROUTE_RE.test(f));
  const hasPagesRouter = files.some((f) => PAGES_PAGE_RE.test(f) && !/_app|_document|_error/.test(f));

  if (hasNext && hasAppRouter && hasPagesRouter) {
    return {
      framework: 'nextjs-mixed',
      supported: true,
      note: 'Next.js with both App Router and Pages Router — both route trees are extracted.',
      hasAppRouter,
      hasPagesRouter,
    };
  }
  if (hasNext && hasAppRouter) {
    return {
      framework: 'nextjs-app',
      supported: true,
      note: 'Next.js App Router — routes read from app/**/page & route handlers.',
      hasAppRouter,
      hasPagesRouter,
    };
  }
  if (hasNext && hasPagesRouter) {
    return {
      framework: 'nextjs-pages',
      supported: true,
      note: 'Next.js Pages Router — routes read from pages/** and pages/api/**.',
      hasAppRouter,
      hasPagesRouter,
    };
  }
  if (hasNext) {
    return {
      framework: 'nextjs-app',
      supported: true,
      note: 'Next.js detected (no route files sampled yet) — treated as App Router; sections inferred from components.',
      hasAppRouter,
      hasPagesRouter,
    };
  }
  if (hasReact) {
    return {
      framework: 'react',
      supported: true,
      note: 'React app (no Next.js) — routes are inferred from top-level components; some routing may need you.',
      hasAppRouter,
      hasPagesRouter,
    };
  }
  return {
    framework: 'unknown',
    supported: false,
    note: 'Not a Next.js or React repo v1 can regenerate. Import falls back to a prompt-seeded guided build; more frameworks land in v2.',
    hasAppRouter,
    hasPagesRouter,
  };
}
