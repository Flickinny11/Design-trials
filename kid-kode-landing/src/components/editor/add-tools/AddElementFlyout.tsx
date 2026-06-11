'use client';

// AddElementFlyout — the Add toolbar group's wired surface (canvas-spec §6
// node lifecycle; P2 Task C, extended by P3 Task C).
//
// Wiring contract (mirrors TextToolsFlyout):
//   - STRUCTURAL creation (Add Element) goes through
//     useGraphSourceStore.getState().addNode(buildBubbleElementNode(...)) —
//     the node builder is owned by ./create-element-node.ts; this file never
//     builds its own node shape. The new node is a BLANK bubble tethered to
//     the current hub (INV-7): no artifact data, codeRef '', backendRef null.
//   - The fresh node is selected (useGraphEditorStore.selectNode) and a toast
//     confirms the tether.
//   - P3: stage-1 "Add Object" is REAL for images. It opens an inline DS
//     sub-panel (upload well + image-link input; ./upload-image.ts owns the
//     transport) that sets the selected bubble's artifact via
//     updateNode(nodeId, buildImagePopulatePatch(...)) — sourceAsset lands,
//     renderMode 'sprite', isStage0Bubble goes false. The mounted bubble does
//     NOT live-swap on a sourceAsset write (ArtifactNode memoizes its
//     Object3D by nodeId+codeRef and `sourceAsset` only lives in the content
//     hash), so we reuse the Save-and-Rebuild surgical remount
//     (rebuildNode: evict + version bump → this one node rebuilds as an
//     image plane; siblings' Object3D references stay stable).
//   - §6 lifecycle strip is now HONEST per the selected node: Bubble →
//     Populated → Built → In System chips track reality (isStage0Bubble /
//     artifact present / builtSnapshot fresh). 3D, video, and code artifact
//     kinds remain "coming soon — needs the build pipeline" — nothing faked.
//
// Chrome: Observatory Brass (raised-bar directive, 2026-06-10) — machined KEY
// faces + recessed wells + engraved grooves from the design-system tokens
// (the same shading constants CanvasToolbar/text-tools use; kept local to
// avoid a circular module edge — CanvasToolbar mounts this flyout). GSAP
// open choreography (staggered reveal, spring ease) + the shared native
// magnetic/elastic hover (animation-tools/magnetic.ts — reused, not
// re-implemented). Honors prefers-reduced-motion. No purple; Icon component
// only; PLAIN-LANGUAGE copy throughout (no spec citations, no machine ids).

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { attachMagnetic } from '@/components/editor/animation-tools/magnetic';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useBuiltSnapshotStore } from '@/stores/useBuiltSnapshotStore';
import { rebuildNode } from '@/lib/editor/rebuild-node';
import { computeNodeContentHash } from '@/lib/editor/node-content-hash';
import type { PrismHub, PrismNode } from '@/lib/prism-graph/types';
import { buildBubbleElementNode, isStage0Bubble } from './create-element-node';
import {
  buildImagePopulatePatch,
  probeImageUrl,
  uploadImageAsset,
  type UploadedImageAsset,
} from './upload-image';

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

/** Magnetic/elastic hover — the SHARED native implementation
 *  (animation-tools/magnetic.ts, raised-bar directive: reuse it). The key
 *  face leans toward the pointer and springs home elastically on leave;
 *  transform-only motion, skipped under prefers-reduced-motion. */
function useMagneticKey<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    return attachMagnetic(el);
  }, []);
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
    hint: 'Assembled into its scene object; built state cached.',
  },
  {
    n: 4,
    name: 'In System',
    action: null,
    hint: 'Caption written into the graph; element fully live.',
  },
] as const;

const COMING_SOON = 'coming soon — needs the build pipeline';

/** Honest §6 stage for the selected node:
 *  1 Bubble (no artifact) → 2 Populated (artifact present, current build not
 *  fresh) → 3 Built (builtSnapshot matches the node's current content hash) →
 *  4 In System (built + a real caption in the graph). 0 = nothing selected. */
function nodeStage(
  node: PrismNode | null,
  snapHash: string | undefined,
  snapStatus: string | undefined,
): 0 | 1 | 2 | 3 | 4 {
  if (!node) return 0;
  if (isStage0Bubble(node)) return 1;
  const fresh =
    snapHash !== undefined &&
    (snapStatus === 'built' || snapStatus === 'repaired') &&
    snapHash === computeNodeContentHash(node);
  if (!fresh) return 2;
  const caption = node.intent?.caption ?? '';
  return caption.trim() !== '' ? 4 : 3;
}

/** Inline Add Object sub-panel — images are REAL (upload well + image-link
 *  input through ./upload-image.ts); 3D / video / code stay honestly deferred. */
function AddObjectPanel({
  busy,
  error,
  onPickFile,
  onUseUrl,
}: {
  busy: 'upload' | 'link' | null;
  error: string | null;
  onPickFile: (file: File | null) => void;
  onUseUrl: (url: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const uploadMagnetRef = useMagneticKey<HTMLButtonElement>();
  const [url, setUrl] = useState('');

  // Reveal choreography on mount (the panel appears on Add Object).
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || prefersReducedMotion()) return;
    const els = panel.querySelectorAll('[data-ao-reveal]');
    if (els.length === 0) return;
    const tween = gsap.fromTo(
      els,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.6)', stagger: 0.05 },
    );
    return () => {
      tween.kill();
    };
  }, []);

  const submitUrl = () => {
    const trimmed = url.trim();
    if (trimmed === '' || busy) return;
    onUseUrl(trimmed);
  };

  return (
    <div ref={panelRef} data-component="add-object-panel" className="flex flex-col gap-2">
      <div data-ao-reveal>
        <SectionLabel>Add object · image</SectionLabel>
      </div>

      {/* Upload well — recessed DS well with a machined key face. */}
      <div data-ao-reveal>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="hidden"
          data-control="add-object-file"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />
        <button
          ref={uploadMagnetRef}
          type="button"
          data-action="add-object-upload"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
          className={`w-full h-11 rounded-ds-sm flex items-center justify-center gap-2 ds-press transition-all ${
            busy ? 'opacity-60 cursor-wait' : 'hover:brightness-[1.12]'
          }`}
          style={{
            background: `linear-gradient(178deg, ${dsAlpha(DS_ACCENT, 0.16)}, ${dsAlpha(DS_ACCENT, 0.05)}), ${KEY_BG}`,
            boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.34)}, ${KEY_SHADOW}`,
          }}
        >
          <Icon name="image" size={13} color={DS.brass200} glow={busy !== 'upload'} />
          <span
            className="text-[10.5px] font-mono font-semibold tracking-wide"
            style={{ color: 'var(--ds-brass-200)' }}
          >
            {busy === 'upload' ? 'Uploading…' : 'Upload a picture'}
          </span>
        </button>
        <div
          className="text-[8.5px] font-mono leading-tight mt-1"
          style={{ color: 'var(--ds-text-low)' }}
        >
          PNG, JPEG, WebP, or AVIF — up to 12 MB. Stored at full resolution.
        </div>
      </div>

      {/* Image-link input — recessed well + Use key. */}
      <div data-ao-reveal className="flex items-stretch gap-1.5">
        <input
          type="text"
          data-control="add-object-url"
          value={url}
          disabled={busy !== null}
          placeholder="…or paste an image link"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitUrl();
          }}
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-ds-xs text-[10px] font-mono outline-none"
          style={{
            background: WELL_BG,
            boxShadow: WELL_SHADOW,
            color: 'var(--ds-text-hi)',
            border: '1px solid rgba(255, 252, 242, 0.07)',
          }}
        />
        <button
          type="button"
          data-action="add-object-use-url"
          disabled={busy !== null || url.trim() === ''}
          onClick={submitUrl}
          className={`px-2.5 rounded-ds-xs text-[9px] font-mono font-semibold ds-press transition-all ${
            busy !== null || url.trim() === ''
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:brightness-[1.15]'
          }`}
          style={{ background: KEY_BG, boxShadow: KEY_SHADOW, color: 'var(--ds-text)' }}
        >
          {busy === 'link' ? 'Checking…' : 'Use'}
        </button>
      </div>

      {/* Honest deferral for the other artifact kinds — nothing faked. */}
      <div
        data-ao-reveal
        className="text-[8px] font-mono leading-tight"
        style={{ color: 'var(--ds-text-low)' }}
      >
        3D, video, and code objects:{' '}
        <span style={{ color: 'var(--ds-ice-300)' }}>{COMING_SOON}</span>.
      </div>

      {/* Plain-language failure surface. */}
      {error && (
        <div
          data-control="add-object-error"
          className="px-2.5 py-2 rounded-ds-sm flex items-start gap-2"
          style={{
            background: dsAlpha(DS.danger, 0.1),
            boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.danger, 0.3)}, var(--ds-chamfer-soft)`,
          }}
        >
          <Icon name="close" size={11} color={DS.danger} />
          <span className="text-[9.5px] font-mono leading-tight" style={{ color: 'var(--ds-text-hi)' }}>
            {error}
          </span>
        </div>
      )}
    </div>
  );
}

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
  // P3 — Add Object inline sub-panel state.
  const [objectPanelOpen, setObjectPanelOpen] = useState(false);
  const [busy, setBusy] = useState<'upload' | 'link' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Selection → honest lifecycle. The flyout tracks the selected node and its
  // builtSnapshot so the §6 chips reflect reality, not a static ladder.
  const selectedNodeId = useGraphEditorStore((s) => s.selectedNodeId);
  const selectedNode = useGraphSourceStore((s) =>
    selectedNodeId ? s.nodes.find((n) => n.nodeId === selectedNodeId) ?? null : null,
  );
  const snap = useBuiltSnapshotStore((s) =>
    selectedNodeId ? s.snapshots[selectedNodeId] : undefined,
  );
  const stage = nodeStage(selectedNode, snap?.hash, snap?.status);
  const selectedIsBubble = !!selectedNode && isStage0Bubble(selectedNode);

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
    // Land the user directly in "give it an image" — the bubble's only
    // enabled stage-1 action.
    setObjectPanelOpen(true);
    setError(null);
    onToast?.(`Bubble added — tethered to ${hub.title ?? hub.hubId}`);
  };

  /** Commit an image asset onto the selected bubble: artifact write + the
   *  Save-and-Rebuild surgical remount (the memoized bubble Object3D never
   *  live-swaps on a sourceAsset change — see file header). */
  const applyImage = (asset: UploadedImageAsset) => {
    const node = selectedNode;
    if (!node || !isStage0Bubble(node)) return;
    const patch = buildImagePopulatePatch(node, asset);
    useGraphSourceStore.getState().updateNode(node.nodeId, patch);
    rebuildNode(node.nodeId);
    setObjectPanelOpen(false);
    setError(null);
    onToast?.('Picture added — the element is built from your image.');
  };

  const onPickFile = async (file: File | null) => {
    if (!file || busy) return;
    setBusy('upload');
    setError(null);
    try {
      applyImage(await uploadImageAsset(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed — please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onUseUrl = async (url: string) => {
    if (busy) return;
    setBusy('link');
    setError(null);
    try {
      applyImage(await probeImageUrl(url));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not load an image from that link — check the URL and try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  /** Per-stage action wiring — real where the pipeline is real, honestly
   *  deferred everywhere else. */
  const stageAction = (
    n: number,
    action: string,
  ): { enabled: boolean; onClick: () => void; title: string } => {
    if (n === 1) {
      const enabled = selectedIsBubble;
      return {
        enabled,
        onClick: () => {
          setError(null);
          setObjectPanelOpen((o) => !o);
        },
        title: enabled
          ? 'Give this bubble an image'
          : 'Select a bubble first — Add Element creates one.',
      };
    }
    if (n === 2) {
      const isImagePopulated = stage === 2 && !!selectedNode?.visual?.sourceAsset;
      if (isImagePopulated) {
        return {
          enabled: true,
          onClick: () => {
            if (!selectedNode) return;
            rebuildNode(selectedNode.nodeId);
            onToast?.('Element rebuilt from its image.');
          },
          title: 'Rebuild this element from its image',
        };
      }
      return {
        enabled: stage === 2,
        onClick: () => setNotice(`${action} — ${COMING_SOON}`),
        title: `${action} — ${COMING_SOON}`,
      };
    }
    // Stage 3 "Add to System" — the system pipeline is not built yet.
    return {
      enabled: stage === 3,
      onClick: () => setNotice(`${action} — ${COMING_SOON}`),
      title: `${action} — ${COMING_SOON}`,
    };
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

      {/* Selected element — the node the lifecycle below describes. */}
      {selectedNode && (
        <div data-ae-reveal>
          <div className="flex items-center gap-2 px-2.5 py-2 ds-well" data-control="selected-element">
            <Icon name={selectedIsBubble ? 'sparkle' : 'image'} size={12} color={DS_ACCENT} />
            <span
              className="flex-1 text-[10px] font-mono truncate"
              style={{ color: 'var(--ds-text)' }}
            >
              {selectedNode.intent?.caption?.split(' · ')[0] || selectedNode.subtype}
            </span>
            <span className="ds-chip ds-chip--brass">
              {STAGES.find((s) => s.n === stage)?.name ?? 'Element'}
            </span>
          </div>
        </div>
      )}

      {/* P3 — inline Add Object sub-panel (images real; rest deferred). */}
      {objectPanelOpen && selectedIsBubble && (
        <div data-ae-reveal>
          <AddObjectPanel
            busy={busy}
            error={error}
            onPickFile={(f) => {
              void onPickFile(f);
            }}
            onUseUrl={(u) => {
              void onUseUrl(u);
            }}
          />
        </div>
      )}

      {/* §6 lifecycle strip — DS chips tracking the SELECTED node's honest
          stage: done stages get a check, the current stage glows brass,
          future stages stay recessed. */}
      <div data-ae-reveal>
        <SectionLabel>Element lifecycle</SectionLabel>
        <div className="flex flex-col gap-1.5">
          {STAGES.map((s) => {
            const isCurrent = stage === s.n;
            const isDone = stage > s.n;
            const act = s.action ? stageAction(s.n, s.action) : null;
            return (
              <div
                key={s.n}
                data-stage={s.n}
                data-stage-state={isDone ? 'done' : isCurrent ? 'current' : 'future'}
                className="px-2.5 py-2 rounded-ds-sm"
                style={
                  isCurrent
                    ? {
                        background: `linear-gradient(178deg, ${dsAlpha(DS_ACCENT, 0.14)}, ${dsAlpha(DS_ACCENT, 0.04)}), var(--ds-grad-ceramic)`,
                        boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.34)}, var(--ds-chamfer-soft)`,
                      }
                    : isDone
                      ? {
                          background: `linear-gradient(178deg, ${dsAlpha(DS.ok, 0.08)}, rgba(0, 0, 0, 0)), var(--ds-grad-ceramic)`,
                          boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ok, 0.22)}, var(--ds-chamfer-soft)`,
                        }
                      : { background: WELL_BG, boxShadow: WELL_SHADOW, opacity: 0.62 }
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-mono font-semibold shrink-0"
                    style={
                      isCurrent
                        ? { background: 'var(--ds-grad-brass)', color: 'var(--ds-ink)', boxShadow: 'var(--ds-glow-brass)' }
                        : isDone
                          ? { background: dsAlpha(DS.ok, 0.18), color: DS.ok, boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ok, 0.4)}` }
                          : { background: 'var(--ds-grad-ceramic)', color: 'var(--ds-text-low)', boxShadow: 'var(--ds-chamfer-soft)' }
                    }
                  >
                    {isDone ? <Icon name="check" size={9} color={DS.ok} /> : s.n}
                  </span>
                  <span
                    className="text-[10px] font-mono font-semibold"
                    style={{
                      color: isCurrent
                        ? 'var(--ds-brass-200)'
                        : isDone
                          ? DS.ok
                          : 'var(--ds-text-mid)',
                    }}
                  >
                    {s.name}
                  </span>
                  {s.action && act && (
                    <button
                      type="button"
                      data-stage-action={s.action}
                      disabled={!act.enabled}
                      onClick={act.enabled ? act.onClick : undefined}
                      className={`ml-auto px-2 h-6 rounded-ds-xs text-[8.5px] font-mono ds-press transition-all ${
                        act.enabled ? 'hover:brightness-[1.15]' : 'cursor-not-allowed opacity-60'
                      }`}
                      style={
                        act.enabled
                          ? { background: KEY_BG, boxShadow: KEY_SHADOW, color: 'var(--ds-text)' }
                          : { background: 'var(--ds-grad-ceramic)', boxShadow: 'var(--ds-chamfer-soft)', color: 'var(--ds-text-low)' }
                      }
                      title={act.title}
                    >
                      {s.action}
                    </button>
                  )}
                </div>
                <div
                  className="text-[8px] font-mono leading-tight mt-1 pl-6"
                  style={{ color: isCurrent ? 'var(--ds-text-mid)' : 'var(--ds-text-low)' }}
                >
                  {s.hint}
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
