// Galaxy semantic policy.
//
// The runtime graph remains complete: header/footer/nav hit planes and other
// implementation helpers still exist as Prism nodes when the app is built. The
// Galaxy overview is a directory of user-meaningful app elements, so it should
// not render every invisible hit plane or repeated app-shell fragment as a
// first-class sphere.

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
  collapsed: number;
  byRole: Record<GalaxyNodeRole, number>;
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
  return {
    total: nodes.length,
    overview,
    collapsed: nodes.length - overview,
    byRole,
  };
}
