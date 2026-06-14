'use client';

// FONT PREVIEW LOADER — lazy Google-Fonts @font-face injection for the font
// picker's scrollable PREVIEW GALLERY (canvas-spec §7.2 / LOGAN-INBOX).
//
// This is EDITOR React chrome, so the DOM is fair game (unlike src/lib/prism/**,
// which is DOM-free). The picker renders each VISIBLE row in its own typeface so
// the user SEES the font before picking it. To do that we lazy-load a single
// preview weight per visible family from the Google Fonts CSS2 endpoint.
//
// CSP NOTE: a repo-wide grep (next.config.mjs has no `headers()`, there is no
// middleware.ts, and nothing sets a Content-Security-Policy header anywhere in
// src/) confirmed there is NO CSP in this app — so fonts.googleapis.com (the
// stylesheet) and fonts.gstatic.com (the woff2 files it references) are NOT
// blocked. We therefore inject real @font-face. If a CSP is ever added that
// blocks those hosts, `markFamilyBlocked` flips the family to its category
// system-stack fallback so the gallery still differentiates serif/sans/mono/
// display — see CATEGORY_STACK below and FontPicker's `fontStackFor`.
//
// Loads are module-level deduped (a family's <link> is injected at most once for
// the page lifetime) and idempotent across picker open/close cycles. We
// intentionally do NOT remove the <link> on cleanup: webfonts are tiny, the OS/
// browser caches them, and re-injecting on every reopen would re-flash the
// gallery. The set of injected links is therefore a deliberate page-lifetime
// cache, not a leak.

// Representative system stacks per Google-Fonts category. Used for the SSR/
// first-paint frame (before the webfont lands) and as the permanent fallback if
// a host CSP ever blocks Google Fonts. Each stack at least distinguishes the
// four broad shapes so the gallery never collapses to one flat face.
export const CATEGORY_STACK: Record<string, string> = {
  serif: 'Georgia, "Times New Roman", "Noto Serif", serif',
  'sans-serif': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  display: '"Trebuchet MS", "Segoe UI", Impact, system-ui, sans-serif',
  handwriting: '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive',
  monospace: '"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
};

const DEFAULT_STACK = CATEGORY_STACK['sans-serif'];

/** A CSS font-family value that renders `family` once its webfont has loaded,
 *  falling back to the category system stack until then (and permanently if the
 *  family was marked blocked by a CSP). The family name is quoted so multi-word
 *  names ("Playfair Display") are valid CSS. */
export function fontStackFor(family: string, category: string): string {
  const stack = CATEGORY_STACK[category] ?? DEFAULT_STACK;
  if (isFamilyBlocked(family)) return stack;
  return `"${family.replace(/"/g, '')}", ${stack}`;
}

// ── Lazy webfont injection (deduped, page-lifetime) ─────────────────────────

const injected = new Set<string>();
const blocked = new Set<string>();

/** Has this family been marked unavailable (CSP blocked / load error)? */
export function isFamilyBlocked(family: string): boolean {
  return blocked.has(family);
}

/** Force a family onto its system-stack fallback (called if a <link> errors —
 *  e.g. a future CSP rejects fonts.googleapis.com). */
export function markFamilyBlocked(family: string): void {
  blocked.add(family);
}

/** Build the Google Fonts CSS2 stylesheet URL for a single family at one
 *  preview weight. `display=swap` shows the fallback immediately, then swaps in
 *  the real face when it arrives — exactly the gallery behaviour we want. */
export function googleFontsCss2Url(family: string, weight = 400): string {
  const spec = `${family.replace(/ /g, '+')}:wght@${weight}`;
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec).replace(/%2B/g, '+').replace(/%3A/g, ':').replace(/%40/g, '@')}&display=swap`;
}

/** Lazily inject one family's preview webfont. Deduped: a family is requested
 *  at most once per page. No-ops on the server (DOM-free) and for already-loaded
 *  or blocked families. Pick a preview weight the family actually ships (nearest
 *  to 400) so the CSS2 request never 400s on a missing weight. */
export function ensurePreviewFont(family: string, weights: number[] = [400]): void {
  if (typeof document === 'undefined') return;
  if (injected.has(family) || blocked.has(family)) return;
  injected.add(family);

  const weight = nearestWeight(weights, 400);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = googleFontsCss2Url(family, weight);
  link.dataset.prismFontPreview = family;
  link.addEventListener('error', () => {
    // Stylesheet host rejected (network / future CSP): fall back permanently.
    injected.delete(family);
    markFamilyBlocked(family);
  });
  document.head.appendChild(link);
}

function nearestWeight(weights: number[], target: number): number {
  if (!weights || weights.length === 0) return target;
  return weights.reduce(
    (best, w) => (Math.abs(w - target) < Math.abs(best - target) ? w : best),
    weights[0],
  );
}
