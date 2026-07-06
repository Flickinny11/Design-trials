// PRISM INGEST — route extraction from file-system conventions (W-IMPORT).
//
// Routes come from Next.js file-system routing (no AST needed):
//   • App Router  — app/**/page.ext → a page; app/**/route.ts → an API handler;
//     app/**/layout.ext → a layout. Route groups `(group)` are stripped from the
//     URL; `[param]` / `[...slug]` mark dynamic segments.
//   • Pages Router — pages/index → '/'; pages/about → '/about';
//     pages/blog/[slug] → '/blog/[slug]'; pages/api/** → API. `_app`/`_document`
//     are framework specials, not routes.
// Route handler HTTP methods are read from the file's exported GET/POST/… names.

import type { AnalyzedApi, AnalyzedRoute } from '../../../packages/shared-interfaces/src/prism-ingest';

const PAGE_EXT_RE = /\.(tsx|ts|jsx|js|mjs)$/;
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function titleCase(seg: string): string {
  const s = seg.replace(/^\[\.*/, '').replace(/\]$/, '').replace(/[-_]+/g, ' ').trim();
  if (!s) return 'Home';
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Turn an app/ dir path into a URL path, stripping route groups + private dirs. */
function appDirToUrl(segments: string[]): string {
  const kept = segments.filter(
    (s) => !(s.startsWith('(') && s.endsWith(')')) && !s.startsWith('_') && s !== '',
  );
  return '/' + kept.join('/');
}

function titleOf(url: string): string {
  const parts = url.split('/').filter(Boolean);
  return parts.length ? titleCase(parts[parts.length - 1]) : 'Home';
}

/** Strip a leading `src/` and return path segments after the routing root. */
function afterRoot(file: string, root: 'app' | 'pages'): string[] | null {
  const norm = file.replace(/^src\//, '');
  const parts = norm.split('/');
  const idx = parts.indexOf(root);
  if (idx === -1) return null;
  return parts.slice(idx + 1);
}

/** Read exported HTTP method names from a route-handler / api file. */
export function methodsFromHandler(text: string | null): string[] {
  if (!text) return ['*'];
  const found = HTTP_METHODS.filter((m) =>
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b|export\\s+const\\s+${m}\\b`).test(text),
  );
  // Pages API default export (a single handler switching on req.method).
  if (found.length === 0 && /export\s+default\s+/.test(text)) return ['*'];
  return found.length ? found : ['*'];
}

export interface RouteExtraction {
  routes: AnalyzedRoute[];
  api: AnalyzedApi[];
}

/** Extract routes + API endpoints. `readText` fetches a file's contents (for
 *  method detection); it may return null. */
export async function extractRoutes(
  files: string[],
  readText: (file: string) => Promise<string | null>,
): Promise<RouteExtraction> {
  const routes: AnalyzedRoute[] = [];
  const api: AnalyzedApi[] = [];
  const seenPaths = new Set<string>();

  for (const file of files) {
    // ── App Router ──────────────────────────────────────────────────────────
    const appSeg = afterRoot(file, 'app');
    if (appSeg && PAGE_EXT_RE.test(file)) {
      const leaf = appSeg[appSeg.length - 1].replace(PAGE_EXT_RE, '');
      const dirSegs = appSeg.slice(0, -1);
      const url = appDirToUrl(dirSegs);
      const dynamic = dirSegs.some((s) => s.includes('['));
      if (leaf === 'page') {
        const key = `page:${url}`;
        if (!seenPaths.has(key)) {
          seenPaths.add(key);
          routes.push({ path: url, kind: 'page', file, dynamic, title: titleOf(url) });
        }
      } else if (leaf === 'route') {
        const text = await readText(file);
        api.push({ path: url, methods: methodsFromHandler(text), file });
        const key = `route:${url}`;
        if (!seenPaths.has(key)) {
          seenPaths.add(key);
          routes.push({ path: url, kind: 'api', file, dynamic, title: titleOf(url) });
        }
      } else if (leaf === 'layout') {
        routes.push({ path: url, kind: 'layout', file, dynamic, title: `${titleOf(url)} layout` });
      }
      continue;
    }

    // ── Pages Router ────────────────────────────────────────────────────────
    const pagesSeg = afterRoot(file, 'pages');
    if (pagesSeg && PAGE_EXT_RE.test(file)) {
      const rel = pagesSeg.join('/').replace(PAGE_EXT_RE, '');
      const leafName = pagesSeg[pagesSeg.length - 1].replace(PAGE_EXT_RE, '');
      if (/^_(app|document|error)$/.test(leafName)) continue;
      const isApi = pagesSeg[0] === 'api';
      // index → parent path; drop trailing 'index'.
      const urlSegs = rel.split('/').filter((s) => s !== 'index');
      const url = '/' + urlSegs.join('/');
      const cleanUrl = url === '/' ? '/' : url.replace(/\/$/, '');
      const dynamic = rel.includes('[');
      if (isApi) {
        const apiUrl = cleanUrl; // already includes /api
        const text = await readText(file);
        api.push({ path: apiUrl, methods: methodsFromHandler(text), file });
        const key = `route:${apiUrl}`;
        if (!seenPaths.has(key)) {
          seenPaths.add(key);
          routes.push({ path: apiUrl, kind: 'api', file, dynamic, title: titleOf(apiUrl) });
        }
      } else {
        const key = `page:${cleanUrl}`;
        if (!seenPaths.has(key)) {
          seenPaths.add(key);
          routes.push({ path: cleanUrl, kind: 'page', file, dynamic, title: titleOf(cleanUrl) });
        }
      }
    }
  }

  routes.sort((a, b) => a.path.localeCompare(b.path));
  api.sort((a, b) => a.path.localeCompare(b.path));
  return { routes, api };
}

/** The human-facing section names for the brief's `sections` line: page routes
 *  only (not api/layout), deduped, home first. */
export function sectionNamesFromRoutes(routes: AnalyzedRoute[]): string[] {
  const pages = routes.filter((r) => r.kind === 'page');
  const names: string[] = [];
  for (const r of pages) {
    const t = r.path === '/' ? 'Home' : (r.title ?? titleOf(r.path));
    if (!names.includes(t)) names.push(t);
  }
  // Home first, then the rest in route order.
  return names.sort((a, b) => (a === 'Home' ? -1 : b === 'Home' ? 1 : 0));
}
