'use client';

// GUIDED-TIPS (P0 contract) — the typed walkthrough step model.
//
// The walkthrough is editor-overlay UI: a thin, a11y-first BESPOKE controller
// (QUEUE-PREP-RESEARCH §DOMAIN B B5) whose step list is pure DATA. It NEVER
// mutates the graph (INV-2/INV-4/FP-3) — it reads + points at the live editor,
// switches view modes (canonical 3 only — INV-3), and composes the 406+
// animatable primitives + DESIGN-REFERENCES for the in-scene 3D popup artifacts.
//
// Two highlight modes per step (D3):
//   • 'dom'   — a smooth spotlight cutout over a real chrome region (Driver.js
//               technique, bespoke SVG-mask scrim).
//   • 'scene' — dim the live 3D scene except a framed artifact window. The frame
//               reveals the SINGLE renderer (no 2nd canvas — INV-1/FP-2); the
//               TipArtifactStage renders the relevant primitive artifact there.
//
// All copy is overlay DOM type (the sanctioned editor-chrome text path — never
// THREE.TextGeometry / diffusion letterforms in the scene, INV-5/INV-11).

import type { ViewMode } from '@/stores/useGraphEditorStore';
import type { SubjectKind, ParamState } from '@/lib/prism/animatable/contract';

export type HighlightMode = 'dom' | 'scene';

/** Accent tone for an artifact's local studio rig + popup frame (Observatory
 *  Brass only — INV-8, no purple). */
export type TipAccent = 'brass' | 'ice';

export interface TipArtifact {
  /** Registry primitive name driving the in-scene 3D artifact (C7/C8). The
   *  artifact shares GraphScene's single renderer via TipArtifactStage. */
  primitive: string;
  /** Optional subject override; defaults to the primitive's own def.subject. */
  subject?: SubjectKind;
  /** Optional param overrides for the primitive. */
  params?: Partial<ParamState>;
  /** Accent tone for the artifact's local studio lights + the popup frame. */
  accent?: TipAccent;
}

export interface WalkthroughStep {
  /** Stable id (used as the dev-hook + evidence key). */
  id: string;
  /** Premium heading shown in the popup. */
  title: string;
  /** Explanation copy (overlay DOM type — INV-5). */
  body: string;
  /** Short kicker above the title (e.g. "VIEW MODES"). */
  kicker: string;
  /** Switch the editor to this view mode before the step runs (INV-3). */
  viewMode?: ViewMode;
  /** Transient editor-SELECTION prep so a selection-gated chrome region (the
   *  Inspector) is present to spotlight. This is editor UI state only — NOT a
   *  graph mutation (INV-2/INV-4) — and the host restores the user's prior
   *  selection when the walkthrough ends. */
  prepare?: 'select-first-node';
  /** dom = chrome spotlight cutout; scene = dim the scene except the artifact. */
  highlightMode: HighlightMode;
  /** CSS selector of the chrome region to spotlight (dom steps). The host
   *  degrades gracefully (centred popup, no cutout) if it is absent. */
  targetSelector?: string;
  /** CSS selector the driven cursor travels to + "clicks". Defaults to
   *  targetSelector; for scene steps it points at the artifact frame. */
  cursorSelector?: string;
  /** The 3D artifact animated in the popup (shares the single renderer). */
  artifact: TipArtifact;
  /** Named primitives / DESIGN-REFERENCES techniques composing the popup
   *  entrance (C8 evidence + the real CSS/animation classes applied). */
  composition: string[];
  /** ARIA label for the step's dialog. */
  a11yLabel: string;
}

/** Controller state machine (D1 / GATE). */
export type WalkthroughStatus = 'idle' | 'running' | 'done' | 'skipped';

/** Viewport-pixel rect the popup publishes for its transparent artifact window
 *  so TipArtifactStage can camera-anchor the in-scene artifact to it. */
export interface ArtifactFrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
