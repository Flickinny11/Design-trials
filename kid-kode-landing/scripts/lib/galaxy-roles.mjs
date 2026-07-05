// galaxy-roles.mjs — the ONE script-side mirror of
// src/lib/prism-graph/galaxy-semantics.ts (role classification + first-level
// component clustering), shared by verify-galaxy-semantics.mjs and
// galaxy-parity-gate.mjs so there is exactly one copy to keep in sync with the
// TS module. The parity gate's LIVE mode cross-checks this mirror against the
// in-page __PRISM_GALAXY_PARITY__ probe (which evaluates the real TS module),
// so any drift between mirror and truth fails machine-checked.

const APP_SHELL_SUBTYPES = new Set([
  'app-header',
  'app-header-rule',
  'brand-wordmark',
  'nav-active-rule',
  'nav-link',
  'app-footer',
  'app-footer-rule',
  'footer-brand',
  'footer-legal',
  'footer-links',
  'footer-social',
]);
const AMBIENT_BACKGROUND_RE = /(?:^|[-_])(starfield|nebula|dust|motes|scatter|particle-field|background|backdrop|ambient)(?:$|[-_])/i;
// Embedded decoration — pure visual-support fragments inside a parent element.
// Kept in the runtime graph (Canvas/Preview build them) but collapsed out of the
// Galaxy overview, like ambient backgrounds. Mirrors galaxy-semantics.ts.
const EMBEDDED_DECORATION_SUBTYPES = new Set(['text-scrim', 'spec-rail-edge', 'panel-chrome']);
const EMBEDDED_DECORATION_RE = /(?:^|[-_])(scrim|chrome|underlay)$/i;

export const GALAXY_ROLES = [
  'content',
  'app-shell',
  'hit-target',
  'global-overlay',
  'ambient-background',
  'embedded-decoration',
];

/** Sanctioned-collapsed roles: implementation atoms the Galaxy overview
 *  deliberately does not surface as first-class spheres (QA protocol §4:
 *  backgrounds/ambience are hub layers, embedded decoration collapsed;
 *  app-shell/hit-target are repeated implementation fragments; global
 *  overlays open as overlays, never spheres). */
export const SANCTIONED_COLLAPSED_ROLES = new Set([
  'app-shell',
  'hit-target',
  'global-overlay',
  'ambient-background',
  'embedded-decoration',
]);

export function roleFor(node) {
  const id = node.nodeId ?? node.id ?? '';
  const subtype = node.subtype ?? '';
  if (node.isGlobalElement || (!node.parentHubId && (!node.hubIds || node.hubIds.length === 0))) return 'global-overlay';
  if (subtype === 'nav-hit' || /(?:^|[-_])hit(?:$|[-_])/.test(subtype)) return 'hit-target';
  if (AMBIENT_BACKGROUND_RE.test(subtype) || AMBIENT_BACKGROUND_RE.test(id)) return 'ambient-background';
  if (EMBEDDED_DECORATION_SUBTYPES.has(subtype) || EMBEDDED_DECORATION_RE.test(subtype)) return 'embedded-decoration';
  if (node.globalSlot || id.startsWith('shell-') || APP_SHELL_SUBTYPES.has(subtype)) return 'app-shell';
  return 'content';
}

function ctaBase(id) {
  return String(id)
    .replace(/-(edge|slab|label)-f4bcta$/i, '')
    .replace(/-(slab|label|edge|button|button-secondary)$/i, '')
    .replace(/-f4bcta-(slab|label|edge)$/i, '-f4bcta');
}

export function clusterSpecFor(node) {
  const id = node.nodeId ?? node.id ?? '';
  const subtype = node.subtype ?? '';
  const hubId = node.parentHubId ?? node.hubIds?.[0] ?? 'global';
  const atelier = id.match(/^orr-atelier-cat-([a-z0-9]+)-/i);
  if (atelier && (subtype === 'atelier-swatch' || subtype === 'atelier-text')) {
    return { key: `${hubId}:atelier:${atelier[1]}`, minSize: 2 };
  }
  const materia = id.match(/^orr-materia-([a-z0-9]+)-/i);
  if (
    materia &&
    /^(plate-frame-(rim|bevel|lip)|material-plate|nameplate|material-label)$/i.test(subtype)
  ) {
    return { key: `${hubId}:material:${materia[1]}`, minSize: 2 };
  }
  if (/^(cta-button|cta-button-secondary|cta-label|cta-edge)$/i.test(subtype)) {
    return { key: `${hubId}:cta:${ctaBase(id)}`, minSize: 2 };
  }
  if (/^orr-acquire-incl-/i.test(id)) {
    return { key: `${hubId}:included`, minSize: 2 };
  }
  if (/^orr-atelier-btn-/i.test(id)) {
    return { key: `${hubId}:atelier-controls`, minSize: 2 };
  }
  if (/^orr-atelier-(price|summary|reason|price-eyebrow)/i.test(id)) {
    return { key: `${hubId}:atelier-summary`, minSize: 2 };
  }
  // text-scrim / spec-rail-edge / panel-chrome are classified as
  // embedded-decoration and never reach the overview, so no support-layers cluster.
  return null;
}

/** Project overview (content-role) nodes into the first-level Galaxy view:
 *  dense component atoms cluster into one element; the rest pass through.
 *  Cluster entries carry `clusterNodeIds` (their member atoms). */
export function projectedNodesFor(list) {
  const entries = [];
  const buckets = new Map();
  for (const node of list) {
    const spec = clusterSpecFor(node);
    if (!spec) {
      entries.push(node);
      continue;
    }
    let bucket = buckets.get(spec.key);
    if (!bucket) {
      bucket = { spec, nodes: [] };
      buckets.set(spec.key, bucket);
      entries.push(bucket);
    }
    bucket.nodes.push(node);
  }
  return entries.flatMap((entry) => {
    if (entry.nodes) {
      return entry.nodes.length >= entry.spec.minSize
        ? [{ nodeId: `galaxy-cluster:${entry.spec.key}`, parentHubId: entry.nodes[0]?.parentHubId, clusterNodeIds: entry.nodes.map((node) => node.nodeId) }]
        : entry.nodes;
    }
    return [entry];
  });
}
