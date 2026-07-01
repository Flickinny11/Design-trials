// Galaxy semantic policy.
//
// The runtime graph remains complete: header/footer/nav hit planes and other
// implementation helpers still exist as Prism nodes when the app is built. The
// Galaxy overview is a directory of user-meaningful app elements, so it should
// not render every invisible hit plane or repeated app-shell fragment as a
// first-class sphere.

import type { EditorNode } from './view-model';

export type GalaxyNodeRole =
  | 'content'
  | 'app-shell'
  | 'hit-target'
  | 'global-overlay'
  | 'ambient-background';

export interface GalaxySemanticNode {
  id?: string;
  nodeId?: string;
  subtype?: string;
  parentHubId?: string;
  hubIds?: string[];
  elementType?: string;
  caption?: string;
  isGlobalElement?: boolean;
  globalSlot?: 'header' | 'footer';
}

export interface GalaxySemanticEdge {
  source?: string;
  target?: string;
  from?: string;
  to?: string;
}

export interface GalaxySemanticSummary {
  total: number;
  overview: number;
  projected: number;
  collapsed: number;
  byRole: Record<GalaxyNodeRole, number>;
}

export type GalaxyProjectionNode = EditorNode;

interface ClusterSpec {
  key: string;
  label: string;
  elementType: string;
  kind: string;
  minSize?: number;
}

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

const HIT_TARGET_SUBTYPES = new Set([
  'nav-hit',
]);

const AMBIENT_BACKGROUND_RE = /(?:^|[-_])(starfield|nebula|dust|motes|scatter|particle-field|background|backdrop|ambient)(?:$|[-_])/i;

function getNodeId(node: GalaxySemanticNode): string {
  return node.id ?? node.nodeId ?? '';
}

function getSubtype(node: GalaxySemanticNode): string {
  return node.subtype ?? '';
}

export function getGalaxyNodeRole(node: GalaxySemanticNode): GalaxyNodeRole {
  const id = getNodeId(node);
  const subtype = getSubtype(node);

  if (node.isGlobalElement || !node.parentHubId && (!node.hubIds || node.hubIds.length === 0)) {
    return 'global-overlay';
  }

  if (HIT_TARGET_SUBTYPES.has(subtype) || /(?:^|[-_])hit(?:$|[-_])/.test(subtype)) {
    return 'hit-target';
  }

  if (AMBIENT_BACKGROUND_RE.test(subtype) || AMBIENT_BACKGROUND_RE.test(id)) {
    return 'ambient-background';
  }

  if (node.globalSlot || id.startsWith('shell-') || APP_SHELL_SUBTYPES.has(subtype)) {
    return 'app-shell';
  }

  return 'content';
}

export function shouldShowInGalaxyOverview(node: GalaxySemanticNode): boolean {
  return getGalaxyNodeRole(node) === 'content';
}

export function getGalaxyOverviewNodes<T extends GalaxySemanticNode>(nodes: readonly T[]): T[] {
  return nodes.filter(shouldShowInGalaxyOverview);
}

function titleCaseSlug(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function ctaBase(id: string): string {
  return id
    .replace(/-(edge|slab|label)-f4bcta$/i, '')
    .replace(/-(slab|label|edge|button|button-secondary)$/i, '')
    .replace(/-f4bcta-(slab|label|edge)$/i, '-f4bcta');
}

function getClusterSpec(node: EditorNode): ClusterSpec | null {
  const id = node.id;
  const subtype = node.subtype ?? '';
  const hubId = node.hubIds[0] ?? 'global';

  const atelier = id.match(/^orr-atelier-cat-([a-z0-9]+)-/i);
  if (atelier && (subtype === 'atelier-swatch' || subtype === 'atelier-text')) {
    const category = atelier[1];
    return {
      key: `${hubId}:atelier:${category}`,
      label: `${titleCaseSlug(category)} options`,
      elementType: 'Atelier option group',
      kind: 'atelier-options',
    };
  }

  const materia = id.match(/^orr-materia-([a-z0-9]+)-/i);
  if (
    materia &&
    /^(plate-frame-(rim|bevel|lip)|material-plate|nameplate|material-label)$/i.test(subtype)
  ) {
    const material = materia[1];
    return {
      key: `${hubId}:material:${material}`,
      label: `${titleCaseSlug(material)} material card`,
      elementType: 'Material component',
      kind: 'material-card',
    };
  }

  if (/^(cta-button|cta-button-secondary|cta-label|cta-edge)$/i.test(subtype)) {
    const base = ctaBase(id);
    return {
      key: `${hubId}:cta:${base}`,
      label: `${titleCaseSlug(base.replace(/^orr-[a-z0-9]+-/i, '').replace(/^hero-/, ''))} CTA`,
      elementType: 'Call-to-action component',
      kind: 'cta',
    };
  }

  if (/^orr-acquire-incl-/i.test(id)) {
    return {
      key: `${hubId}:included`,
      label: 'Included benefits',
      elementType: 'Feature-list component',
      kind: 'feature-list',
    };
  }

  if (/^orr-atelier-btn-/i.test(id)) {
    return {
      key: `${hubId}:atelier-controls`,
      label: 'Atelier controls',
      elementType: 'Control component group',
      kind: 'atelier-controls',
    };
  }

  if (/^orr-atelier-(price|summary|reason|price-eyebrow)/i.test(id)) {
    return {
      key: `${hubId}:atelier-summary`,
      label: 'Atelier summary',
      elementType: 'Summary component group',
      kind: 'atelier-summary',
    };
  }

  if (/^(text-scrim|spec-rail-edge|panel-chrome)$/i.test(subtype)) {
    return {
      key: `${hubId}:support-layers`,
      label: 'Support layers',
      elementType: 'Visual support cluster',
      kind: 'support-layers',
      minSize: 1,
    };
  }

  return null;
}

function makeClusterNode(spec: ClusterSpec, children: EditorNode[]): EditorNode {
  const first = children[0];
  const childNames = children
    .slice(0, 5)
    .map((node) => node.name)
    .join(', ');
  const suffix = children.length > 5 ? `, +${children.length - 5} more` : '';
  return {
    ...first,
    id: `galaxy-cluster:${spec.key}`,
    subtype: 'galaxy-component-cluster',
    name: spec.label,
    elementType: spec.elementType,
    caption: `${children.length} editable graph nodes grouped for Galaxy clarity: ${childNames}${suffix}. Open Canvas to edit the individual nodes.`,
    hasBackend: children.some((node) => node.hasBackend),
    hasAnimation: children.some((node) => node.hasAnimation),
    animationFrames: children.reduce((sum, node) => sum + (node.animationFrames ?? 0), 0),
    stateCount: children.reduce((sum, node) => sum + node.stateCount, 0),
    textContent: children.flatMap((node) => node.textContent).slice(0, 8),
    interactions: children.flatMap((node) => node.interactions).slice(0, 12),
    backendContract: children.find((node) => node.backendContract)?.backendContract,
    isGalaxyCluster: true,
    galaxyClusterKind: spec.kind,
    clusterNodeIds: children.map((node) => node.id),
    clusterChildCount: children.length,
  };
}

export function getGalaxyOverviewProjection(nodes: readonly EditorNode[]): GalaxyProjectionNode[] {
  const entries: Array<EditorNode | { spec: ClusterSpec; children: EditorNode[] }> = [];
  const bucketByKey = new Map<string, { spec: ClusterSpec; children: EditorNode[] }>();

  for (const node of getGalaxyOverviewNodes(nodes)) {
    const spec = getClusterSpec(node);
    if (!spec) {
      entries.push(node);
      continue;
    }

    let bucket = bucketByKey.get(spec.key);
    if (!bucket) {
      bucket = { spec, children: [] };
      bucketByKey.set(spec.key, bucket);
      entries.push(bucket);
    }
    bucket.children.push(node);
  }

  return entries.flatMap((entry) => {
    if ('children' in entry) {
      const minSize = entry.spec.minSize ?? 2;
      return entry.children.length >= minSize
        ? [makeClusterNode(entry.spec, entry.children)]
        : entry.children;
    }
    return [entry];
  });
}

export function countGalaxyProjectedNodesForHub(
  nodes: readonly EditorNode[],
  hubId: string,
): number {
  return getGalaxyOverviewProjection(nodes)
    .filter((node) => node.hubIds.includes(hubId))
    .length;
}

export function countGalaxyOverviewNodesForHub(
  nodes: readonly GalaxySemanticNode[],
  hubId: string,
): number {
  return nodes.filter((node) => {
    const hubIds = node.hubIds ?? (node.parentHubId ? [node.parentHubId] : []);
    return hubIds.includes(hubId) && shouldShowInGalaxyOverview(node);
  }).length;
}

export function filterEdgesToGalaxyOverview<TEdge extends GalaxySemanticEdge>(
  edges: readonly TEdge[],
  overviewNodeIds: ReadonlySet<string>,
): TEdge[] {
  return edges.filter((edge) => {
    const source = edge.source ?? edge.from;
    const target = edge.target ?? edge.to;
    return !!source && !!target && overviewNodeIds.has(source) && overviewNodeIds.has(target);
  });
}

export function summarizeGalaxySemantics(nodes: readonly GalaxySemanticNode[]): GalaxySemanticSummary {
  const byRole: Record<GalaxyNodeRole, number> = {
    content: 0,
    'app-shell': 0,
    'hit-target': 0,
    'global-overlay': 0,
    'ambient-background': 0,
  };

  for (const node of nodes) {
    byRole[getGalaxyNodeRole(node)] += 1;
  }

  const overview = byRole.content;
  const projected = nodes.length > 0 && 'visualSpec' in nodes[0]
    ? getGalaxyOverviewProjection(nodes as readonly EditorNode[]).length
    : overview;
  return {
    total: nodes.length,
    overview,
    projected,
    collapsed: nodes.length - overview,
    byRole,
  };
}
