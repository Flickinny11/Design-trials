'use client';

// PRISM SHELL — BUILDER SHELL ROOT (SHELL W1 → W2 TASK 0)
//
// The three-region builder (spec §1 S4): streaming chat LEFT, engine preview
// RIGHT, right-side tabs — under a top bar with project identity, model
// selector, and share stub. Mode controls live EXCLUSIVELY in the preview
// frame's own header (founder addendum 2026-07-04: the Lovable/Claude-Design
// anatomy — nothing mode-related above or inside the chat column). Owns the
// engine bridge (ONE host per session, contract envelopes only) and the E12
// mobile layout: at phone widths the chat and the stage become swipeable
// scroll-snap panes with an indicator rail; the frame header travels with
// the preview pane.
//
// Scroll ownership: the root layout locks body scroll (W0 gotcha), so this
// route owns its viewport — 100dvh, internal regions scroll themselves.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PrismViewMode } from '../../../../packages/shared-interfaces/src/prism-shell';
import { useBuilderStore } from '@/lib/shell/builder-store';
import { useCollabStore } from '@/lib/shell/collab-store';
import { useEngineBridge } from '@/lib/shell/engine/use-engine-bridge';
import { getStubProject } from '@/lib/shell/project-stub';
import ChatRegion from './ChatRegion';
import PresenceLayer from './PresenceLayer';
import PreviewRegion from './PreviewRegion';
import RightTabs, { type BuilderTab } from './RightTabs';
import TopBar from './TopBar';

const ENGINE_CONTAINER_ID = 'prism-engine-container';

/** The viewer's resolved access to this project (W7). `canCollaborate` gates
 *  the enterprise-only multiplayer surface; when false, NO collab chrome
 *  mounts (non-enterprise tenants see no multiplayer surface). */
export interface BuilderAccess {
  viewer: { actorId: string; displayName: string } | null;
  role: 'owner' | 'edit' | 'comment' | 'view' | null;
  enterprise: boolean;
  canCollaborate: boolean;
  canManageSharing: boolean;
  canEdit: boolean;
}

/** Client-side presence tint seed (matches colorForSeed's domain). */
function seedFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

const PANES = [
  { key: 'chat', label: 'Chat' },
  { key: 'stage', label: 'Preview' },
] as const;

export default function BuilderShell({
  projectId,
  projectName,
  buildState,
  access,
}: {
  projectId: string;
  /** Real tenant project name (W1A) — falls back to the W1 humanized slug
   *  for ids that are not owned projects (stub/demo routes). */
  projectName?: string;
  /** Build ladder position (W2). `plan-pending` = an approved Build Brief was
   *  handed off from Guided Build intake; the Conductor authors the plan in W5. */
  buildState?: string | null;
  /** W7 — the viewer's resolved access (null for anon/stub). */
  access?: BuilderAccess | null;
}) {
  const stub = getStubProject(projectId);
  const project = projectName ? { ...stub, name: projectName } : stub;
  const { sendCommand } = useEngineBridge({
    containerId: ENGINE_CONTAINER_ID,
    graphRef: project.graphRef,
    // UXV-F3: a project that is already built at page load renders
    // ConductorPreview — the engine container is never in the DOM, so a
    // mount request can only fail with CONTAINER_MISSING on every reload.
    suppressMount: buildState === 'built',
  });

  const [activeTab, setActiveTab] = useState<BuilderTab>('inspector');

  // ── W7 live multiplayer (enterprise-gated) ───────────────────────────────
  // Connect the CollabRoom channel ONLY when the viewer may collaborate
  // (enterprise org + edit/owner). Otherwise no socket opens and no presence
  // chrome renders — non-enterprise tenants see no multiplayer surface.
  const collabEnabled = Boolean(access?.canCollaborate && access?.viewer);
  useEffect(() => {
    if (!collabEnabled || !access?.viewer) return;
    const { actorId, displayName } = access.viewer;
    useCollabStore
      .getState()
      .connect(projectId, { actorId, displayName, colorSeed: seedFrom(actorId) });
    return () => useCollabStore.getState().disconnect();
  }, [collabEnabled, projectId, access?.viewer]);

  const selectedNodeIdForPresence = useBuilderStore((s) => s.selectedNodeId);
  const onPreviewPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!collabEnabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(1, rect.width);
      const y = (e.clientY - rect.top) / Math.max(1, rect.height);
      useCollabStore
        .getState()
        .sendCursor(
          { x, y },
          selectedNodeIdForPresence ? [selectedNodeIdForPresence] : [],
          selectedNodeIdForPresence ?? undefined,
        );
    },
    [collabEnabled, selectedNodeIdForPresence],
  );
  const onPreviewPointerLeave = useCallback(() => {
    if (collabEnabled) useCollabStore.getState().sendCursor(undefined, []);
  }, [collabEnabled]);

  // A user click in the engine pulls the Inspector forward (shell highlight
  // half of the Visual-Edit round-trip). Command echoes do NOT (the shell
  // ignores its own writes coming back — origin discipline).
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
  const lastSelectionOrigin = useBuilderStore((s) => s.lastSelectionOrigin);
  useEffect(() => {
    if (selectedNodeId && lastSelectionOrigin === 'user') setActiveTab('inspector');
  }, [selectedNodeId, lastSelectionOrigin]);

  const noteModeRequested = useBuilderStore((s) => s.noteModeRequested);
  const onSelectMode = useCallback(
    (mode: PrismViewMode) => {
      noteModeRequested(mode);
      sendCommand({ type: 'set-mode', mode });
    },
    [noteModeRequested, sendCommand],
  );

  // ── E12 mobile panes ───────────────────────────────────────────────────────
  const regionsRef = useRef<HTMLDivElement>(null);
  const [activePane, setActivePane] = useState(0);

  const onRegionsScroll = useCallback(() => {
    const el = regionsRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    setActivePane(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const goToPane = useCallback((index: number) => {
    const el = regionsRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }, []);

  return (
    <div className="bw1-root">
      <TopBar
        projectName={project.name}
        projectId={project.id}
        access={access ?? null}
      />

      <nav className="bw1-pane-nav" aria-label="Builder panes">
        {PANES.map((p, i) => (
          <button
            key={p.key}
            type="button"
            className="bw1-pane-dot"
            data-active={activePane === i ? 'true' : 'false'}
            aria-label={`Show ${p.label} pane`}
            aria-current={activePane === i}
            onClick={() => goToPane(i)}
          >
            <span className="bw1-pane-dot-bead" aria-hidden />
            {p.label}
          </button>
        ))}
      </nav>

      <div className="bw1-regions" ref={regionsRef} onScroll={onRegionsScroll}>
        <section className="bw1-chat" aria-label="Build chat">
          <ChatRegion projectId={project.id} />
        </section>
        <div className="bw1-stage">
          <section
            className="bw1-preview"
            aria-label="Engine preview"
            onPointerMove={onPreviewPointerMove}
            onPointerLeave={onPreviewPointerLeave}
          >
            <PreviewRegion
              containerId={ENGINE_CONTAINER_ID}
              graphRef={project.graphRef}
              projectId={project.id}
              projectName={project.name}
              planPending={buildState === 'plan-pending'}
              buildState={buildState ?? null}
              sendCommand={sendCommand}
              onSelectMode={onSelectMode}
            />
            {collabEnabled ? <PresenceLayer /> : null}
          </section>
          <aside className="bw1-tabs" aria-label="Builder panels">
            <RightTabs
              projectId={project.id}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              sendCommand={sendCommand}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
