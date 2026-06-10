'use client';

// AddElementFlyout — the Add toolbar group's wired surface (canvas-spec §6
// node lifecycle, state 1; P2 Task C).
//
// Wiring contract (mirrors TextToolsFlyout):
//   - STRUCTURAL creation (Add Element) goes through
//     useGraphSourceStore.getState().addNode(buildBubbleElementNode(...)) —
//     the node builder is owned by ./create-element-node.ts; this file never
//     builds its own node shape. The new node is a BLANK bubble tethered to
//     the current hub (INV-7): no artifact data, codeRef '', backendRef null.
//   - The fresh node is selected (useGraphEditorStore.selectNode) and a toast
//     confirms the tether.
//   - §6 lifecycle strip: Bubble → Populated → Built → In System rendered as
//     DS chips. Per §6, only "Add Object" is enabled at stage 1 — but its
//     BEHAVIOR (attaching an image / mesh / video / code artifact) belongs to
//     the P3 artifact pipeline, so clicking it surfaces an HONEST
//     "coming soon — needs the build pipeline" notice. Nothing is faked. Later stages
//     are dimmed with the same honest hints.
//
// Chrome: Observatory Brass (raised-bar directive, 2026-06-10) — machined KEY
// faces + recessed wells + engraved grooves from the design-system tokens
// (the same shading constants CanvasToolbar/text-tools use; kept local to
// avoid a circular module edge — CanvasToolbar mounts this flyout). GSAP
// open choreography (staggered reveal, spring ease) + a native
// magnetic/elastic hover on the primary key (pointer-proximity transforms
// via gsap.quickTo; no new dependency, no second renderer). Honors
// prefers-reduced-motion. No purple; Icon component only.

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import type { PrismHub } from '@/lib/prism-graph/types';
import { buildBubbleElementNode } from './create-element-node';

// ── Observatory Brass treatments (derived from design-system tokens ONLY;
//    same machined constants as CanvasToolbar / text-tools/ui.tsx) ──────────
const KEY_BG = 'linear-gradient(178deg, var(--ds-slate), var(--ds-charcoal))';
const KEY_SHADOW = 'var(--ds-chamfer-soft), 0 1px 2px rgba(0, 0, 0, 0.45)';
const WELL_BG = 'var(--ds-grad-well)';
const WELL_SHADOW =
  'inset 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(255, 252, 242, 0.05)';

const GROOVE_H: React.CSSProperties = {
  background:
    'linear-gradient(90deg, var(--ds-edge-shade), rgba(0, 0, 0, 0) 92%) top / 100% 1px no-repeat, ' +
    'linear-gradient(90deg, var(--ds-edge-side), rgba(255, 252, 242, 0) 86%) bottom / 100% 1px no-repeat',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1.5 mt-0.5">
      <span
        className="text-[9px] font-mono tracking-[0.18em] uppercase whitespace-nowrap"
        style={{ color: 'var(--ds-text-low)', textShadow: '0 1px 0 rgba(0, 0, 0, 0.55)' }}
      >
        {children}
      </span>
      <span aria-hidden className="flex-1 min-w-3 h-[2px]" style={GROOVE_H} />
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Magnetic/elastic hover (DESIGN-REFERENCES "magnetic-elements" /
 *  "mouse-follower" TECHNIQUE, implemented natively): the key face leans
 *  toward the pointer with gsap.quickTo while hovered and springs home with
 *  an elastic ease on leave. Transform-only motion (DS contract). */
function useMagneticKey<T extends HTMLElement>(strength = 0.22) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3.out' });
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const onLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.75, ease: 'elastic.out(1, 0.36)' });
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      gsap.killTweensOf(el);
    };
  }, [strength]);
  return ref;
}

// §6 lifecycle stages (canvas-spec §6 "Node lifecycle in Canvas").
const STAGES = [
  {
    n: 1,
    name: 'Bubble',
    action: 'Add Object',
    hint: 'Translucent liquid sphere. Draggable. Only Add Object enabled.',
  },
  {
    n: 2,
    name: 'Populated',
    action: 'Build Node',
    hint: 'Has an artifact (image / mesh / video / text / code).',
  },
  {
    n: 3,
    name: 'Built',
    action: 'Add to System',
    hint: 'Assembled into its scene object; builtSnapshot cached.',
  },
  {
    n: 4,
    name: 'In System',
    action: null,
    hint: 'Caption written into the graph; element fully live.',
  },
] as const;

export default function AddElementFlyout({
  hub,
  onToast,
}: {
  /** Active hub resolution shared with the other wired groups (active hub →
   *  selected node's parent hub → first hub). Add Element tethers here. */
  hub: PrismHub | null;
  onToast?: (msg: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const magnetRef = useMagneticKey<HTMLButtonElement>();
  // Honest deferred-action notice ("coming soon — needs the build pipeline").
  const [notice, setNotice] = useState<string | null>(null);

  // Open choreography — staggered reveal of the flyout sections with a spring
  // ease (raised-bar directive). Transform/opacity only; skipped under
  // prefers-reduced-motion.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const els = root.querySelectorAll('[data-ae-reveal]');
    if (els.length === 0) return;
    const tween = gsap.fromTo(
      els,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)', stagger: 0.055 },
    );
    return () => {
      tween.kill();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(t);
  }, [notice]);

  const addElement = () => {
    if (!hub) return;
    const id = useGraphSourceStore
      .getState()
      .addNode(buildBubbleElementNode({ parentHubId: hub.hubId }));
    useGraphEditorStore.getState().selectNode(id);
    onToast?.(`Bubble added — tethered to ${hub.title ?? hub.hubId}`);
  };

  return (
    <div ref={rootRef} data-component="add-element-flyout" className="flex flex-col gap-2.5">
      {/* Primary key — Add Element (creates the §6 stage-1 blank bubble). */}
      <div data-ae-reveal>
        <button
          ref={magnetRef}
          type="button"
          data-action="add-element"
          disabled={!hub}
          onClick={addElement}
          className={`w-full h-12 rounded-ds-sm flex items-center justify-center gap-2 ds-press transition-all ${
            hub ? 'hover:brightness-[1.12]' : 'opacity-40 cursor-not-allowed'
          }`}
          style={
            hub
              ? {
                  background: `linear-gradient(178deg, ${dsAlpha(DS_ACCENT, 0.2)}, ${dsAlpha(DS_ACCENT, 0.06)}), ${KEY_BG}`,
                  boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.4)}, ${KEY_SHADOW}, 0 0 14px ${dsAlpha(DS_ACCENT, 0.14)}`,
                }
              : { background: 'var(--ds-grad-ceramic)', boxShadow: 'var(--ds-chamfer-soft)' }
          }
        >
          <Icon name="plus" size={14} color={hub ? DS.brass200 : DS.textMid} glow={!!hub} />
          <span
            className="text-[11px] font-mono font-semibold tracking-wide"
            style={{ color: hub ? 'var(--ds-brass-200)' : 'var(--ds-text-mid)' }}
          >
            Add Element
          </span>
        </button>
        <div
          className="text-[8.5px] font-mono leading-tight mt-1.5"
          style={{ color: 'var(--ds-text-low)' }}
        >
          {hub
            ? <>Adds a blank bubble to <span style={{ color: 'var(--ds-text)' }}>{hub.title ?? hub.hubId}</span> — give it an artifact to bring it to life.</>
            : 'Needs a current hub — drill into a hub first.'}
        </div>
      </div>

      {/* §6 lifecycle strip — DS chips. Stage 1 is live (its Add Object
          action defers honestly to P3); stages 2–4 are dimmed. */}
      <div data-ae-reveal>
        <SectionLabel>Element lifecycle</SectionLabel>
        <div className="flex flex-col gap-1.5">
          {STAGES.map((s) => {
            const live = s.n === 1;
            return (
              <div
                key={s.n}
                data-stage={s.n}
                className="px-2.5 py-2 rounded-ds-sm"
                style={
                  live
                    ? {
                        background: `linear-gradient(178deg, ${dsAlpha(DS_ACCENT, 0.14)}, ${dsAlpha(DS_ACCENT, 0.04)}), var(--ds-grad-ceramic)`,
                        boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.34)}, var(--ds-chamfer-soft)`,
                      }
                    : { background: WELL_BG, boxShadow: WELL_SHADOW, opacity: 0.62 }
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-mono font-semibold shrink-0"
                    style={
                      live
                        ? { background: 'var(--ds-grad-brass)', color: 'var(--ds-ink)', boxShadow: 'var(--ds-glow-brass)' }
                        : { background: 'var(--ds-grad-ceramic)', color: 'var(--ds-text-low)', boxShadow: 'var(--ds-chamfer-soft)' }
                    }
                  >
                    {s.n}
                  </span>
                  <span
                    className="text-[10px] font-mono font-semibold"
                    style={{ color: live ? 'var(--ds-brass-200)' : 'var(--ds-text-mid)' }}
                  >
                    {s.name}
                  </span>
                  {s.action && (
                    <button
                      type="button"
                      data-stage-action={s.action}
                      disabled={!live}
                      onClick={
                        live
                          ? () => setNotice(`${s.action} — coming soon — needs the build pipeline`)
                          : undefined
                      }
                      className={`ml-auto px-2 h-6 rounded-ds-xs text-[8.5px] font-mono ds-press transition-all ${
                        live ? 'hover:brightness-[1.15]' : 'cursor-not-allowed'
                      }`}
                      style={
                        live
                          ? { background: KEY_BG, boxShadow: KEY_SHADOW, color: 'var(--ds-text)' }
                          : { background: 'var(--ds-grad-ceramic)', boxShadow: 'var(--ds-chamfer-soft)', color: 'var(--ds-text-low)' }
                      }
                      title={
                        live
                          ? `${s.action} — coming soon — needs the build pipeline`
                          : `${s.action} — coming soon — needs the build pipeline`
                      }
                    >
                      {s.action}
                    </button>
                  )}
                </div>
                <div
                  className="text-[8px] font-mono leading-tight mt-1 pl-6"
                  style={{ color: live ? 'var(--ds-text-mid)' : 'var(--ds-text-low)' }}
                >
                  {s.hint}
                  {!live && (
                    <span style={{ color: 'var(--ds-ice-300)' }}> · coming soon — needs the build pipeline</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Honest deferred-action notice (mirrors the toolbar's "coming" state;
          ice accent = not-wired vocabulary). */}
      {notice && (
        <div
          className="px-2.5 py-2 rounded-ds-sm flex items-start gap-2 ds-reveal"
          style={{
            background: dsAlpha(DS.ice400, 0.1),
            boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.28)}, var(--ds-chamfer-soft)`,
          }}
        >
          <Icon name="sparkle" size={12} color={DS.ice300} glow />
          <div className="leading-tight">
            <div className="text-[10px] font-mono" style={{ color: 'var(--ds-text-hi)' }}>
              {notice}
            </div>
            <div className="text-[8.5px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>
              The bubble stays a graph-tethered intent slot until then.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
