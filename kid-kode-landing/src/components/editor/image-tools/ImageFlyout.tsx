'use client';

// ImageFlyout — the Image toolbar group's wired surface (canvas-spec §5 Image
// tools; P3 Task B).
//
// Wiring contract (mirrors TextToolsFlyout / AddElementFlyout):
//   - STRUCTURAL creation (upload / paste-a-link / honest generate) goes
//     through useGraphSourceStore.getState().addNode(buildImageNode(...)) —
//     the node builder is owned by ./image-helpers.ts; this file never builds
//     its own node shape. An image node is BORN Populated: visual.sourceAsset
//     IS its artifact (upload and URL both end as a URL).
//   - Upload POSTs through uploadImageAsset (add-tools/upload-image, the
//     frozen cross-agent seam) which returns { url, width, height }; the
//     plane is sized from those pixels (native resolution is preserved — the
//     texture path never downscales; sizing only sets the plane extent).
//   - REPLACE swaps visual.sourceAsset via the sanctioned toolbar route
//     (source-store updateNode — the toolbar is not an Inspector tab, same
//     rule Transform/Lighting use) and then triggers the surgical Save-and-
//     Rebuild path (lib/editor/rebuild-node): one node remounts, siblings'
//     Object3D references stay stable.
//   - PRESENTATION controls write node.imageSpec via updateNode as a
//     whole-object replacement (withImageSpecPatch / withCropPatch). The
//     renderer's live image-spec path restyles instantly — no rebuild.
//   - GENERATE is honest: it probes POST /api/prism/image-gen once and, while
//     the endpoint reports it is not wired, shows a plain-language disclosure.
//     Output is NEVER faked.
//
// Chrome: Chrome-Arc (raised-bar directive) — machined KEY faces +
// recessed wells + engraved kicker labels reused from animation-tools/ui,
// GSAP open choreography, native magnetic hover on the primary keys
// (animation-tools/magnetic). Honors prefers-reduced-motion. No purple;
// project Icon component only; plain-language copy (no machine ids).

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { rebuildNode } from '@/lib/editor/rebuild-node';
import { uploadImageAsset } from '@/components/editor/add-tools/upload-image';
import { attachMagnetic } from '@/components/editor/animation-tools/magnetic';
import {
  ChipKey,
  KEY_BG,
  KEY_SHADOW,
  SectionLabel,
  WELL_BG,
  WELL_SHADOW,
  WellInput,
  activeKeyStyle,
} from '@/components/editor/animation-tools/ui';
import type { ImageSpec, PrismHub, PrismNode } from '@/lib/prism-graph/types';
import {
  buildImageNode,
  effectiveImageSpec,
  imageDisplayName,
  isImageBearingNode,
  normalizeImageUrl,
  withCropPatch,
  withImageSpecPatch,
} from './image-helpers';

// Plain-language copy (kept as constants so apostrophes stay typographic and
// the strings stay greppable — no spec citations, no machine ids).
const GEN_DISCLOSURE =
  "Image generation isn't connected yet — it needs the cloud endpoint. Upload or paste a URL instead.";
const URL_LOAD_FAIL = "Couldn't load that image — check the link.";
const URL_NOT_A_LINK = "That doesn't look like an image link.";
const UPLOAD_FAIL = "Upload didn't go through — try again.";
const NOT_AN_IMAGE_FILE = "That file isn't an image — try a PNG, JPG, or WebP.";

const FIT_OPTIONS: Array<{ value: NonNullable<ImageSpec['fit']>; label: string; hint: string }> = [
  { value: 'cover', label: 'Cover', hint: 'Fill the frame, cropping the overflow' },
  { value: 'contain', label: 'Contain', hint: 'Show the whole picture inside the frame' },
  { value: 'fill', label: 'Stretch', hint: 'Stretch the picture to the frame' },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Load `url` in an offscreen <img> to read its native pixel size. This is a
 *  component-side probe (DOM is fine here — the DOM-free rule scopes the
 *  runtime, not editor chrome). The texture itself is loaded later by the
 *  renderer at full native resolution. */
function probeImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.Image === 'undefined') {
      reject(new Error('no DOM'));
      return;
    }
    const img = new window.Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = url;
  });
}

// ── Fader (same machined range pattern as the Lighting flyout) ───────────────
function FaderRow({
  label, value, onChange, min = 0, max = 1, step = 0.01, accent, testId, readout,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; accent?: string; testId?: string;
  readout?: string;
}) {
  const a = accent ?? DS_ACCENT;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>{label}</span>
        <span
          className="text-[9.5px] font-mono tabular-nums px-1.5 py-0.5 rounded-ds-xs"
          style={{ color: a, background: WELL_BG, boxShadow: WELL_SHADOW }}
        >
          {readout ?? pct(value)}
        </span>
      </div>
      <input
        type="range"
        data-control={testId}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="ds-slider w-full cursor-pointer"
      />
    </div>
  );
}

/** Native magnetic hover on a key face (reuses animation-tools/magnetic). */
function useMagnetic<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    return attachMagnetic(el, { maxShift: 5, scale: 1.03 });
  }, []);
  return ref;
}

export default function ImageFlyout({
  node,
  hub,
  onToast,
}: {
  /** Currently selected node (or null). */
  node: PrismNode | null;
  /** Active hub resolution shared with the other wired groups (active hub →
   *  selected node's parent hub → first hub). Add Image tethers here. */
  hub: PrismHub | null;
  onToast: (msg: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const browseRef = useMagnetic<HTMLButtonElement>();
  const generateRef = useMagnetic<HTMLButtonElement>();
  const addFileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState<'add' | 'replace' | 'url' | 'generate' | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [urlText, setUrlText] = useState('');
  const [prompt, setPrompt] = useState('');
  const [genNotice, setGenNotice] = useState<string | null>(null);

  const isImageNode = isImageBearingNode(node);
  const spec = effectiveImageSpec(node?.imageSpec);
  const hubName = hub?.title ?? 'this hub';
  const selectionName = node
    ? node.intent?.caption?.split(' · ')[0] || node.subtype || 'selected element'
    : null;

  // Open choreography — staggered reveal with a spring ease (raised bar).
  // Transform/opacity only; skipped under prefers-reduced-motion.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const els = root.querySelectorAll('[data-im-reveal]');
    if (els.length === 0) return;
    const tween = gsap.fromTo(
      els,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)', stagger: 0.05 },
    );
    return () => {
      tween.kill();
    };
  }, []);

  useEffect(() => {
    if (!genNotice) return;
    const t = setTimeout(() => setGenNotice(null), 6000);
    return () => clearTimeout(t);
  }, [genNotice]);

  // ── Node creation (structural — source-store addNode is the sanctioned
  //    path; the builder is owned by image-helpers) ───────────────────────────
  const addImageNode = (url: string, width?: number, height?: number, sourceName?: string) => {
    if (!hub) return;
    const id = useGraphSourceStore
      .getState()
      .addNode(buildImageNode({ parentHubId: hub.hubId, url, width, height, sourceName }));
    useGraphEditorStore.getState().selectNode(id);
    onToast(`Image added to ${hubName}`);
  };

  // ── Replace (swap the artifact, then the surgical rebuild path) ────────────
  const replaceImage = (url: string) => {
    if (!node || !isImageBearingNode(node)) return;
    useGraphSourceStore
      .getState()
      .updateNode(node.nodeId, { visual: { ...node.visual, sourceAsset: url } });
    rebuildNode(node.nodeId);
    onToast('Picture swapped — rebuilt in place');
  };

  // ── Upload path (file drop / browse → uploadImageAsset → node) ─────────────
  const handleFiles = async (files: FileList | File[] | null, mode: 'add' | 'replace') => {
    const file = files?.[0];
    if (!file || busy) return;
    if (!file.type.startsWith('image/')) {
      onToast(NOT_AN_IMAGE_FILE);
      return;
    }
    setBusy(mode);
    try {
      const { url, width, height } = await uploadImageAsset(file);
      if (mode === 'add') addImageNode(url, width, height, file.name);
      else replaceImage(url);
    } catch {
      onToast(UPLOAD_FAIL);
    } finally {
      setBusy(null);
    }
  };

  // ── Paste-a-link path (try to load; toast on failure — no validation
  //    theater) ────────────────────────────────────────────────────────────────
  const handleUrl = async (mode: 'add' | 'replace') => {
    if (busy) return;
    const url = normalizeImageUrl(urlText);
    if (!url) {
      onToast(URL_NOT_A_LINK);
      return;
    }
    setBusy(mode === 'add' ? 'url' : 'replace');
    try {
      const dims = await probeImage(url);
      if (mode === 'add') addImageNode(url, dims.width, dims.height);
      else replaceImage(url);
      setUrlText('');
    } catch {
      onToast(URL_LOAD_FAIL);
    } finally {
      setBusy(null);
    }
  };

  // ── Honest generate probe ───────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (busy || !prompt.trim()) return;
    setBusy('generate');
    try {
      const res = await fetch('/api/prism/image-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data: unknown = await res.json().catch(() => null);
      const record = (data ?? {}) as { wired?: unknown; url?: unknown; width?: unknown; height?: unknown };
      if (res.ok && record.wired === true && typeof record.url === 'string') {
        // Future-honest: only ever creates a node from a REAL endpoint result.
        addImageNode(
          record.url,
          typeof record.width === 'number' ? record.width : undefined,
          typeof record.height === 'number' ? record.height : undefined,
        );
      } else {
        setGenNotice(GEN_DISCLOSURE);
      }
    } catch {
      setGenNotice(GEN_DISCLOSURE);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={rootRef} data-component="image-flyout" className="flex flex-col gap-2.5">
      {/* ── Add image — upload ─────────────────────────────────────────────── */}
      <div data-im-reveal>
        <SectionLabel>Add image</SectionLabel>
        <div
          data-control="image-drop-well"
          onDragOver={(e) => {
            e.preventDefault();
            if (hub && !busy) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (hub && !busy) void handleFiles(e.dataTransfer?.files ?? null, 'add');
          }}
          className="flex flex-col items-center gap-2 px-3 py-3.5 rounded-ds-sm transition-all"
          style={{
            background: WELL_BG,
            boxShadow: dragOver
              ? `${WELL_SHADOW}, inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.55)}, 0 0 16px ${dsAlpha(DS_ACCENT, 0.18)}`
              : WELL_SHADOW,
            border: `1px dashed ${dragOver ? dsAlpha(DS_ACCENT, 0.7) : 'rgba(255, 252, 242, 0.13)'}`,
            opacity: hub ? 1 : 0.5,
          }}
        >
          <Icon name="image" size={18} color={dragOver ? DS.metal200 : DS.textMid} glow={dragOver} />
          <span className="text-[9.5px] font-mono text-center leading-relaxed" style={{ color: 'var(--ds-text-mid)' }}>
            {hub
              ? busy === 'add'
                ? 'Uploading…'
                : 'Drop a picture here'
              : 'Open a hub on the canvas first — new images attach to it.'}
          </span>
          <button
            ref={browseRef}
            type="button"
            data-action="image-browse"
            disabled={!hub || busy !== null}
            onClick={() => addFileInputRef.current?.click()}
            className={`px-3.5 h-8 rounded-ds-sm flex items-center justify-center gap-1.5 ds-press transition-all ${
              hub && !busy ? 'hover:brightness-[1.12]' : 'opacity-40 cursor-not-allowed'
            }`}
            style={
              hub && !busy
                ? {
                    background: `linear-gradient(178deg, ${dsAlpha(DS_ACCENT, 0.2)}, ${dsAlpha(DS_ACCENT, 0.06)}), ${KEY_BG}`,
                    boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.4)}, ${KEY_SHADOW}, 0 0 14px ${dsAlpha(DS_ACCENT, 0.14)}`,
                  }
                : { background: 'var(--ds-grad-ceramic)', boxShadow: 'var(--ds-chamfer-soft)' }
            }
          >
            <Icon name="plus" size={11} color={hub && !busy ? DS.metal200 : DS.textMid} glow={!!hub && !busy} />
            <span
              className="text-[10px] font-mono font-semibold tracking-wide"
              style={{ color: hub && !busy ? 'var(--ds-metal-200)' : 'var(--ds-text-mid)' }}
            >
              {busy === 'add' ? 'Uploading…' : 'Browse files'}
            </span>
          </button>
          <input
            ref={addFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-control="image-file-input"
            onChange={(e) => {
              void handleFiles(e.target.files, 'add');
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* ── Add image — paste a link ───────────────────────────────────────── */}
      <div data-im-reveal className="flex flex-col gap-1.5">
        <SectionLabel>Or paste a link</SectionLabel>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <WellInput
              value={urlText}
              onChange={setUrlText}
              placeholder="https://…"
              testId="image-url-input"
            />
          </div>
          <ChipKey
            label={busy === 'url' ? 'Loading…' : 'Add'}
            disabled={!hub || busy !== null || urlText.trim().length === 0}
            onClick={() => void handleUrl('add')}
            title="Load the link and add it to the scene"
            testId="image-url-add"
          />
        </div>
      </div>

      {/* ── Replace on the selected image element ──────────────────────────── */}
      <div data-im-reveal>
        <SectionLabel>Replace</SectionLabel>
        {isImageNode && node ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-2.5 py-2 ds-well">
              <Icon name="image" size={12} color={DS_ACCENT} />
              <span className="flex-1 text-[10px] font-mono truncate" style={{ color: 'var(--ds-text)' }}>
                {selectionName}
              </span>
              {imageDisplayName(node.visual?.sourceAsset) && (
                <span className="text-[8.5px] font-mono truncate max-w-[80px]" style={{ color: 'var(--ds-text-low)' }}>
                  {imageDisplayName(node.visual?.sourceAsset)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-action="image-replace-file"
                disabled={busy !== null}
                onClick={() => replaceFileInputRef.current?.click()}
                className={`h-8 rounded-ds-sm flex items-center justify-center gap-1.5 ds-press transition-all ${
                  busy ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-[1.15]'
                }`}
                style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
              >
                <Icon name="refresh" size={11} color={DS.text} />
                <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text)' }}>
                  {busy === 'replace' ? 'Swapping…' : 'Swap file'}
                </span>
              </button>
              <button
                type="button"
                data-action="image-replace-url"
                disabled={busy !== null || urlText.trim().length === 0}
                onClick={() => void handleUrl('replace')}
                title="Swap in the link pasted above"
                className={`h-8 rounded-ds-sm flex items-center justify-center gap-1.5 ds-press transition-all ${
                  busy || urlText.trim().length === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-[1.15]'
                }`}
                style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
              >
                <Icon name="link" size={11} color={DS.text} />
                <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text)' }}>Swap from link</span>
              </button>
            </div>
            <div className="text-[8px] font-mono leading-tight" style={{ color: 'var(--ds-text-low)' }}>
              Keeps the element where it is — only the picture changes.
            </div>
            <input
              ref={replaceFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-control="image-replace-file-input"
              onChange={(e) => {
                void handleFiles(e.target.files, 'replace');
                e.target.value = '';
              }}
            />
          </div>
        ) : (
          <div className="text-[8.5px] font-mono leading-relaxed px-1" style={{ color: 'var(--ds-text-low)' }}>
            {node
              ? 'The selected element has no picture — select one that does (or add an image above) to swap it.'
              : 'Select an element with a picture to swap it.'}
          </div>
        )}
      </div>

      {/* ── Presentation — fit / crop / corners / opacity ──────────────────── */}
      <div data-im-reveal>
        <SectionLabel>Presentation</SectionLabel>
        {isImageNode && node ? (
          <PresentationControls
            key={node.nodeId}
            nodeId={node.nodeId}
            current={node.imageSpec}
            spec={spec}
          />
        ) : (
          <div className="text-[8.5px] font-mono leading-relaxed px-1" style={{ color: 'var(--ds-text-low)' }}>
            Select an element with a picture to set how it fills its frame —
            fit, crop, rounded corners, and opacity.
          </div>
        )}
      </div>

      {/* ── Generate (honest) ──────────────────────────────────────────────── */}
      <div data-im-reveal className="flex flex-col gap-1.5">
        <SectionLabel>Generate</SectionLabel>
        <WellInput
          value={prompt}
          onChange={setPrompt}
          placeholder="Describe the picture you want…"
          testId="image-gen-prompt"
        />
        <button
          ref={generateRef}
          type="button"
          data-action="image-generate"
          disabled={busy !== null || prompt.trim().length === 0}
          onClick={() => void handleGenerate()}
          className={`w-full h-9 rounded-ds-sm flex items-center justify-center gap-2 ds-press transition-all ${
            busy || prompt.trim().length === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-[1.12]'
          }`}
          style={
            busy || prompt.trim().length === 0
              ? { background: 'var(--ds-grad-ceramic)', boxShadow: 'var(--ds-chamfer-soft)' }
              : activeKeyStyle(DS_ACCENT)
          }
        >
          <Icon
            name="sparkle"
            size={13}
            color={busy || prompt.trim().length === 0 ? DS.textMid : DS.metal200}
            glow={!busy && prompt.trim().length > 0}
          />
          <span
            className="text-[10.5px] font-mono font-semibold"
            style={{ color: busy || prompt.trim().length === 0 ? 'var(--ds-text-mid)' : 'var(--ds-metal-200)' }}
          >
            {busy === 'generate' ? 'Checking…' : 'Generate'}
          </span>
        </button>
        {genNotice && (
          <div
            className="px-2.5 py-2 rounded-ds-sm flex items-start gap-2 ds-reveal"
            data-control="image-gen-notice"
            style={{
              background: dsAlpha(DS.ice400, 0.1),
              boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.28)}, var(--ds-chamfer-soft)`,
            }}
          >
            <Icon name="sparkle" size={12} color={DS.ice300} glow />
            <span className="text-[9px] font-mono leading-relaxed" style={{ color: 'var(--ds-text)' }}>
              {genNotice}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Presentation controls (writes node.imageSpec via updateNode — the
//    sanctioned toolbar route; whole-object replacement each write) ──────────
function PresentationControls({
  nodeId,
  current,
  spec,
}: {
  nodeId: string;
  current: ImageSpec | undefined;
  spec: ReturnType<typeof effectiveImageSpec>;
}) {
  const write = (next: ImageSpec) => {
    useGraphSourceStore.getState().updateNode(nodeId, { imageSpec: next });
  };
  const cropIsFullFrame =
    spec.crop.x === 0 && spec.crop.y === 0 && spec.crop.width === 1 && spec.crop.height === 1;

  return (
    <div className="flex flex-col gap-2">
      {/* Fit */}
      <div className="grid grid-cols-3 gap-1.5">
        {FIT_OPTIONS.map((f) => (
          <ChipKey
            key={f.value}
            label={f.label}
            active={spec.fit === f.value}
            title={f.hint}
            testId={`image-fit-${f.value}`}
            onClick={() => write(withImageSpecPatch(current, { fit: f.value }))}
          />
        ))}
      </div>

      {/* Crop */}
      <div className="flex items-center justify-between">
        <span
          className="text-[9px] font-mono tracking-[0.18em] uppercase"
          style={{ color: 'var(--ds-text-low)', textShadow: '0 1px 0 rgba(0, 0, 0, 0.55)' }}
        >
          Crop
        </span>
        {!cropIsFullFrame && (
          <button
            type="button"
            data-action="image-crop-reset"
            onClick={() => write(withImageSpecPatch(current, { crop: { x: 0, y: 0, width: 1, height: 1 } }))}
            className="px-2 h-5 rounded-ds-xs ds-press hover:brightness-[1.15] transition-all text-[8px] font-mono"
            style={{ background: KEY_BG, boxShadow: KEY_SHADOW, color: 'var(--ds-text-mid)' }}
          >
            Reset
          </button>
        )}
      </div>
      <FaderRow
        label="Left edge"
        value={spec.crop.x}
        testId="image-crop-x"
        onChange={(v) => write(withCropPatch(current, { x: v }))}
      />
      <FaderRow
        label="Top edge"
        value={spec.crop.y}
        testId="image-crop-y"
        onChange={(v) => write(withCropPatch(current, { y: v }))}
      />
      <FaderRow
        label="Width"
        value={spec.crop.width}
        testId="image-crop-w"
        onChange={(v) => write(withCropPatch(current, { width: v }))}
      />
      <FaderRow
        label="Height"
        value={spec.crop.height}
        testId="image-crop-h"
        onChange={(v) => write(withCropPatch(current, { height: v }))}
      />

      {/* Corners + opacity */}
      <FaderRow
        label="Rounded corners"
        value={spec.cornerRadius}
        accent={DS.metal300}
        testId="image-corner-radius"
        onChange={(v) => write(withImageSpecPatch(current, { cornerRadius: v }))}
      />
      <FaderRow
        label="Opacity"
        value={spec.opacity}
        accent={DS.ice300}
        testId="image-opacity"
        onChange={(v) => write(withImageSpecPatch(current, { opacity: v }))}
      />
      <div className="text-[8px] font-mono leading-tight" style={{ color: 'var(--ds-text-low)' }}>
        Changes show on the canvas instantly.
      </div>
    </div>
  );
}
