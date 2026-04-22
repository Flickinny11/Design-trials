// Prism hub-router — the virtual node that every navbar-link / navbar-logo /
// footer-link targets with its `navigate` event. Resolves the event's source
// nodeId to a scroll target and (optionally) an active navbar-link id, drives
// the viewport GSAP scroll, and emits `active-section-changed` so navbar-link
// nodes can lock their 'active' overlay layer.
//
// Satisfies §10.14 (verbatim from spec extract):
//   "Nav link clicks (e.g., 'Features') scroll-animate to the corresponding
//   section using GSAP, with the active section indicated in the navbar via
//   overlay state."
//
// The routing table is passed in rather than derived — boot.ts owns the
// mapping from source node → section (since it knows the current hub graph).

import type { EventBus } from './event-bus';
import type { ScrollViewport } from './scroll-viewport';

export interface HubRoute {
  sourceNodeId: string;        // e.g. 'navbar-link-editor'
  scrollY: number;             // content-space y to scroll to
  sectionId: string;           // logical section id ('home', 'hero', ...)
  activeNavLinkId: string | null; // which navbar-link to light up (null = none)
}

export interface ActiveSectionPayload {
  sectionId: string;
  activeNavLinkId: string | null;
}

export interface HubRouter {
  readonly routes: ReadonlyMap<string, HubRoute>;
  readonly activeSectionId: string | null;
  readonly activeNavLinkId: string | null;
  navigate(sourceNodeId: string): boolean;
  setActive(sectionId: string, activeNavLinkId: string | null): void;
  destroy(): void;
}

export interface HubRouterOptions {
  events: EventBus;
  viewport: ScrollViewport;
  routes: HubRoute[];
  duration?: number;
  initialSectionId?: string;
  initialNavLinkId?: string | null;
}

export function createHubRouter(opts: HubRouterOptions): HubRouter {
  const routes = new Map<string, HubRoute>(opts.routes.map((r) => [r.sourceNodeId, r]));
  const duration = opts.duration ?? 0.8;
  let activeSectionId: string | null = opts.initialSectionId ?? null;
  let activeNavLinkId: string | null = opts.initialNavLinkId ?? null;

  function broadcastActive() {
    const payload: ActiveSectionPayload = { sectionId: activeSectionId ?? '', activeNavLinkId };
    opts.events.emit('active-section-changed', payload);
  }

  function setActive(sectionId: string, navLinkId: string | null) {
    activeSectionId = sectionId;
    activeNavLinkId = navLinkId;
    broadcastActive();
  }

  function navigate(sourceNodeId: string): boolean {
    const route = routes.get(sourceNodeId);
    if (!route) return false;
    opts.viewport.scrollTo(route.scrollY, { duration });
    if (activeSectionId !== route.sectionId || activeNavLinkId !== route.activeNavLinkId) {
      activeSectionId = route.sectionId;
      activeNavLinkId = route.activeNavLinkId;
      broadcastActive();
    }
    return true;
  }

  const offNavigate = opts.events.on('navigate', (payload) => {
    const source = (payload as { source?: unknown })?.source;
    if (typeof source !== 'string') return;
    navigate(source);
  });

  if (activeSectionId !== null) broadcastActive();

  return {
    routes,
    get activeSectionId() { return activeSectionId; },
    get activeNavLinkId() { return activeNavLinkId; },
    navigate,
    setActive,
    destroy() { offNavigate(); },
  };
}
