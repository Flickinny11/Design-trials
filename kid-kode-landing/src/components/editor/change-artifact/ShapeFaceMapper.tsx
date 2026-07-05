'use client';

// ShapeFaceMapper — the "Add a picture to a shape" surface of the Change
// Artifact wizard (canvas §12.1, criterion 19). Pick a shape, see its numbered
// faces, drop (or click) images onto faces, nudge the shape's dimensions, and
// fine-tune the active face's crop + see-through.
//
// Controlled component: every edit calls onChange with the FULL next mapping —
// this file holds no shape state of its own (only ephemeral drag/active-slot UI
// state). It never builds nodes or writes to any store; the wizard window owns
// persistence.
//
// Chrome: Chrome-Arc, reusing the animation-tools kit (machined KEY
// faces, recessed WELL troughs, engraved SectionLabel grooves) and the
// ImageFlyout FaderRow + crop-merge idiom 1:1, so this reads as the same
// instrument. GSAP entrance + native magnetic hover honor prefers-reduced-
// motion. No purple; project Icon component only; plain-language copy.

import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import {
  ChipKey,
  KEY_BG,
  KEY_SHADOW,
  SectionLabel,
  WELL_BG,
  WELL_SHADOW,
  activeKeyStyle,
} from '@/components/editor/animation-tools/ui';
import {
  FACE_SLOT_COUNT,
  MESH_PRIMITIVE_DEFAULTS,
  type FaceTexture,
  type MeshPrimitiveKind,
} from '@/lib/prism-graph/types';
import type { ShapeFaceMapperProps, ShapeMapping } from './wizard-types';

// ── Plain-language shape catalogue (no machine ids in the copy) ──────────────
// The spec-named shapes the picker offers. Each carries a project Icon glyph.
const SHAPES: Array<{ kind: MeshPrimitiveKind; label: string; icon: string }> = [
  { kind: 'cube', label: 'Cube', icon: 'cube' },
  { kind: 'sphere', label: 'Sphere', icon: 'snow' },
  { kind: 'cone', label: 'Cone', icon: 'diamond' },
  { kind: 'cylinder', label: 'Cylinder', icon: 'server' },
  { kind: 'plane', label: 'Plane', icon: 'image' },
];

// Per-kind face names. When a kind has fewer named slots than its count, the
// extra slots fall back to "Face N" (cube uses the numeric fallback for all 6).
const FACE_NAMES: Partial<Record<MeshPrimitiveKind, string[]>> = {
  cone: ['Side', 'Base'],
  cylinder: ['Side', 'Top', 'Bottom'],
  sphere: ['Surface'],
  plane: ['Surface'],
};

// The dimension faders shown per kind (only the dims that matter for that
// shape). Range stays a gentle 0.1..2.0 for every dim.
const DIM_FADERS: Record<MeshPrimitiveKind, Array<{ key: string; label: string }>> = {
  cube: [
    { key: 'width', label: 'Width' },
    { key: 'height', label: 'Height' },
    { key: 'depth', label: 'Depth' },
  ],
  sphere: [{ key: 'radius', label: 'Size' }],
  plane: [
    { key: 'width', label: 'Width' },
    { key: 'height', label: 'Height' },
  ],
  cylinder: [
    { key: 'radius', label: 'Radius' },
    { key: 'height', label: 'Height' },
  ],
  cone: [
    { key: 'radius', label: 'Radius' },
    { key: 'height', label: 'Height' },
  ],
  // torus / capsule aren't offered in the picker, but the contract allows the
  // value to arrive as either — keep sensible faders so we never render empty.
  torus: [
    { key: 'radius', label: 'Radius' },
    { key: 'tube', label: 'Thickness' },
  ],
  capsule: [
    { key: 'radius', label: 'Radius' },
    { key: 'length', label: 'Length' },
  ],
};

const DRAG_MIME = 'text/uri-list';
const pct = (v: number) => `${Math.round(v * 100)}%`;
const num = (v: number) => v.toFixed(2);

function faceName(kind: MeshPrimitiveKind, i: number): string {
  const named = FACE_NAMES[kind];
  if (named && named[i]) return named[i];
  return `Face ${i + 1}`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// ── Fader (same machined range pattern as ImageFlyout's FaderRow) ────────────
function FaderRow({
  label, value, onChange, min = 0, max = 1, step = 0.01, accent, readout, testId,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; accent?: string;
  readout?: string; testId?: string;
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

export default function ShapeFaceMapper({ value, images, onChange }: ShapeFaceMapperProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Ephemeral UI state only — never the source of truth for the mapping.
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  // When a slot is clicked with !==1 pool image, it arms; the next pool click
  // assigns to it (the required keyboard/click fallback for drag).
  const [armedSlot, setArmedSlot] = useState<number | null>(null);

  const kind = value.kind;
  const slotCount = FACE_SLOT_COUNT[kind] ?? 1;

  // Keep the active slot in range whenever the shape (and thus slot count)
  // changes. Pure derived clamp — no onChange side effect.
  useEffect(() => {
    setActiveSlot((s) => (s < slotCount ? s : 0));
    setArmedSlot(null);
  }, [slotCount, kind]);

  // Open choreography — staggered reveal, transform/opacity only, skipped under
  // reduced-motion and killed on unmount (matches ImageFlyout).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const els = root.querySelectorAll('[data-sfm-reveal]');
    if (els.length === 0) return;
    const tween = gsap.fromTo(
      els,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.42, ease: 'back.out(1.5)', stagger: 0.05 },
    );
    return () => {
      tween.kill();
    };
  }, []);

  // ── Mapping mutators — every one emits the FULL next ShapeMapping ──────────
  const emit = (next: ShapeMapping) => onChange(next);

  const pickShape = (nextKind: MeshPrimitiveKind) => {
    if (nextKind === kind) return;
    const nextCount = FACE_SLOT_COUNT[nextKind] ?? 1;
    emit({
      kind: nextKind,
      params: { ...MESH_PRIMITIVE_DEFAULTS[nextKind] },
      faceTextures: value.faceTextures.filter((f) => f.faceIndex < nextCount),
    });
    setActiveSlot(0);
    setArmedSlot(null);
  };

  const assignFace = (faceIndex: number, url: string) => {
    const without = value.faceTextures.filter((f) => f.faceIndex !== faceIndex);
    const prior = value.faceTextures.find((f) => f.faceIndex === faceIndex);
    // Preserve any existing crop/opacity when only the picture changes.
    const next: FaceTexture = { faceIndex, url, crop: prior?.crop, opacity: prior?.opacity };
    emit({ ...value, faceTextures: [...without, next].sort((a, b) => a.faceIndex - b.faceIndex) });
    setActiveSlot(faceIndex);
    setArmedSlot(null);
  };

  const clearFace = (faceIndex: number) => {
    emit({ ...value, faceTextures: value.faceTextures.filter((f) => f.faceIndex !== faceIndex) });
    setArmedSlot(null);
  };

  const setDim = (key: string, v: number) => {
    emit({ ...value, params: { ...value.params, [key]: v } });
  };

  // Whole-object replace of a face's crop window (the withCrop merge idiom).
  const setCrop = (faceIndex: number, patch: { x?: number; y?: number; width?: number; height?: number }) => {
    const tex = value.faceTextures.find((f) => f.faceIndex === faceIndex);
    if (!tex) return;
    const base = { x: 0, y: 0, width: 1, height: 1, ...tex.crop };
    const nextTex: FaceTexture = { ...tex, crop: { ...base, ...patch } };
    emit({
      ...value,
      faceTextures: value.faceTextures.map((f) => (f.faceIndex === faceIndex ? nextTex : f)),
    });
  };

  const setOpacity = (faceIndex: number, v: number) => {
    const tex = value.faceTextures.find((f) => f.faceIndex === faceIndex);
    if (!tex) return;
    emit({
      ...value,
      faceTextures: value.faceTextures.map((f) =>
        f.faceIndex === faceIndex ? { ...f, opacity: v } : f,
      ),
    });
  };

  // Click-to-assign fallback: 1 pool image → assign it; otherwise arm the slot.
  const onSlotClick = (faceIndex: number) => {
    if (images.length === 1) {
      assignFace(faceIndex, images[0].url);
      return;
    }
    setActiveSlot(faceIndex);
    setArmedSlot((s) => (s === faceIndex ? null : faceIndex));
  };

  // Pool-tile click: if a slot is armed, assign there; else nudge it onto the
  // active slot so a single click always lands somewhere predictable.
  const onPoolClick = (url: string) => {
    const target = armedSlot ?? activeSlot;
    assignFace(target, url);
  };

  const texFor = (faceIndex: number): FaceTexture | undefined =>
    value.faceTextures.find((f) => f.faceIndex === faceIndex);

  const activeTex = texFor(activeSlot);
  const dimFaders = DIM_FADERS[kind] ?? DIM_FADERS.cube;
  const activeCrop = useMemo(
    () => ({ x: 0, y: 0, width: 1, height: 1, ...activeTex?.crop }),
    [activeTex],
  );

  return (
    <div ref={rootRef} data-component="shape-face-mapper" className="flex flex-col gap-3">
      {/* ── 1. Shape picker ─────────────────────────────────────────────────── */}
      <div data-sfm-reveal>
        <SectionLabel>Pick a shape</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {SHAPES.map((s) => {
            const active = s.kind === kind;
            return (
              <button
                key={s.kind}
                type="button"
                data-action={`shape-${s.kind}`}
                aria-pressed={active}
                onClick={() => pickShape(s.kind)}
                title={s.label}
                className="flex items-center gap-1.5 px-2.5 h-8 rounded-ds-sm ds-press transition-all hover:brightness-[1.12]"
                style={
                  active
                    ? { ...activeKeyStyle(DS_ACCENT), color: 'var(--ds-text-hi)' }
                    : { background: KEY_BG, boxShadow: KEY_SHADOW, color: 'var(--ds-text)' }
                }
              >
                <Icon name={s.icon} size={13} color={active ? DS.metal200 : DS.textMid} glow={active} />
                <span
                  className="text-[10px] font-mono font-semibold tracking-wide"
                  style={{ color: active ? 'var(--ds-metal-200)' : 'var(--ds-text)' }}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 text-[9px] font-mono" style={{ color: 'var(--ds-text-low)' }}>
          {slotCount} {slotCount === 1 ? 'face' : 'faces'}
        </div>
      </div>

      {/* ── 2. Face slots (numbered drop wells / click targets) ─────────────── */}
      <div data-sfm-reveal>
        <SectionLabel>Faces</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: slotCount }).map((_, i) => {
            const tex = texFor(i);
            const isActive = i === activeSlot;
            const isArmed = i === armedSlot;
            const isDragOver = i === dragSlot;
            const ring = isDragOver || isArmed
              ? dsAlpha(DS_ACCENT, 0.7)
              : isActive
                ? dsAlpha(DS_ACCENT, 0.45)
                : 'rgba(255, 252, 242, 0.1)';
            return (
              <div key={i} className="relative">
                <button
                  type="button"
                  data-action={`face-slot-${i}`}
                  aria-label={`${faceName(kind, i)} — ${tex ? 'has a picture, click to select' : 'empty, click to add a picture'}`}
                  aria-pressed={isActive}
                  onClick={() => onSlotClick(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragSlot(i);
                  }}
                  onDragLeave={() => setDragSlot((s) => (s === i ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragSlot(null);
                    const url =
                      e.dataTransfer?.getData(DRAG_MIME) ||
                      e.dataTransfer?.getData('text/plain') ||
                      '';
                    if (url) assignFace(i, url.trim());
                  }}
                  className="w-full aspect-square rounded-ds-sm overflow-hidden flex flex-col items-center justify-center gap-1 ds-press transition-all"
                  style={{
                    background: WELL_BG,
                    boxShadow: `${WELL_SHADOW}, inset 0 0 0 1px ${ring}${
                      isDragOver ? `, 0 0 14px ${dsAlpha(DS_ACCENT, 0.2)}` : ''
                    }`,
                  }}
                >
                  {tex ? (
                    <img
                      src={tex.url}
                      alt=""
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ opacity: tex.opacity ?? 1 }}
                    />
                  ) : (
                    <>
                      <Icon name="plus" size={12} color={isArmed ? DS.metal200 : DS.textLow} glow={isArmed} />
                      <span className="text-[8px] font-mono leading-none" style={{ color: 'var(--ds-text-low)' }}>
                        {faceName(kind, i)}
                      </span>
                    </>
                  )}
                  {/* Numbered badge — always 1..N, matches faceIndex + 1. */}
                  <span
                    className="absolute top-1 left-1 min-w-[15px] h-[15px] px-1 rounded-ds-xs flex items-center justify-center text-[8px] font-mono font-semibold tabular-nums"
                    style={{
                      background: dsAlpha(DS.void, 0.62),
                      color: isActive ? DS.metal200 : DS.text,
                      boxShadow: `inset 0 0 0 1px ${dsAlpha(isActive ? DS_ACCENT : DS.steel, 0.6)}`,
                    }}
                  >
                    {i + 1}
                  </span>
                </button>
                {tex && (
                  <button
                    type="button"
                    data-action={`face-clear-${i}`}
                    aria-label={`Remove the picture on ${faceName(kind, i)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFace(i);
                    }}
                    className="absolute top-1 right-1 w-[17px] h-[17px] rounded-ds-xs flex items-center justify-center ds-press hover:brightness-[1.2] transition-all"
                    style={{ background: dsAlpha(DS.void, 0.66), boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.danger, 0.5)}` }}
                  >
                    <Icon name="close" size={9} color={DS.danger} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {armedSlot !== null && (
          <div className="mt-1.5 text-[8.5px] font-mono leading-relaxed px-0.5" style={{ color: 'var(--ds-metal-200)' }}>
            {faceName(kind, armedSlot)} is ready — tap a picture below to drop it on.
          </div>
        )}
      </div>

      {/* ── 3. Image pool (draggable tiles) ─────────────────────────────────── */}
      <div data-sfm-reveal>
        <SectionLabel>Your pictures</SectionLabel>
        {images.length === 0 ? (
          <div
            className="px-2.5 py-3 rounded-ds-sm text-[9px] font-mono leading-relaxed text-center"
            style={{ background: WELL_BG, boxShadow: WELL_SHADOW, color: 'var(--ds-text-low)' }}
          >
            Upload pictures above to drop onto faces.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {images.map((img, idx) => (
              <button
                key={`${img.url}-${idx}`}
                type="button"
                draggable
                data-action={`pool-image-${idx}`}
                title={img.label ?? 'Drag onto a face, or tap to drop it on the selected face'}
                aria-label={img.label ? `Picture: ${img.label}` : `Picture ${idx + 1}`}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, img.url);
                  e.dataTransfer.setData('text/plain', img.url);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onPoolClick(img.url)}
                className="relative aspect-square rounded-ds-sm overflow-hidden ds-press hover:brightness-[1.12] transition-all cursor-grab active:cursor-grabbing"
                style={{ background: WELL_BG, boxShadow: `${WELL_SHADOW}, inset 0 0 0 1px rgba(255, 252, 242, 0.08)` }}
              >
                <img
                  src={img.url}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
              </button>
            ))}
          </div>
        )}
        {images.length > 1 && (
          <div className="mt-1.5 text-[8px] font-mono leading-tight px-0.5" style={{ color: 'var(--ds-text-low)' }}>
            Drag a picture onto a face — or tap a face, then tap a picture.
          </div>
        )}
      </div>

      {/* ── 4. Modify shape (per-kind dimension faders) ─────────────────────── */}
      <div data-sfm-reveal className="flex flex-col gap-2">
        <SectionLabel>Modify shape</SectionLabel>
        {dimFaders.map((d) => {
          const v = value.params[d.key];
          const current = typeof v === 'number' ? v : (MESH_PRIMITIVE_DEFAULTS[kind][d.key as keyof typeof MESH_PRIMITIVE_DEFAULTS['cube']] ?? 0.6);
          return (
            <FaderRow
              key={d.key}
              label={d.label}
              value={current}
              min={0.1}
              max={2.0}
              step={0.01}
              readout={num(current)}
              testId={`shape-dim-${d.key}`}
              onChange={(nv) => setDim(d.key, nv)}
            />
          );
        })}
      </div>

      {/* ── 5. Adjust the selected face (crop + see-through) ────────────────── */}
      <div data-sfm-reveal className="flex flex-col gap-2">
        <SectionLabel>Adjust this face</SectionLabel>
        {activeTex ? (
          <>
            <div className="flex items-center gap-2 px-2.5 py-2 ds-well">
              <Icon name="crop" size={12} color={DS_ACCENT} />
              <span className="flex-1 text-[10px] font-mono truncate" style={{ color: 'var(--ds-text)' }}>
                {faceName(kind, activeSlot)} <span style={{ color: 'var(--ds-text-low)' }}>· {activeSlot + 1}</span>
              </span>
            </div>
            <FaderRow
              label="Crop from left"
              value={activeCrop.x}
              readout={pct(activeCrop.x)}
              testId="face-crop-x"
              onChange={(v) => setCrop(activeSlot, { x: v })}
            />
            <FaderRow
              label="Crop from top"
              value={activeCrop.y}
              readout={pct(activeCrop.y)}
              testId="face-crop-y"
              onChange={(v) => setCrop(activeSlot, { y: v })}
            />
            <FaderRow
              label="Width"
              value={activeCrop.width}
              readout={pct(activeCrop.width)}
              testId="face-crop-w"
              onChange={(v) => setCrop(activeSlot, { width: v })}
            />
            <FaderRow
              label="Height"
              value={activeCrop.height}
              readout={pct(activeCrop.height)}
              testId="face-crop-h"
              onChange={(v) => setCrop(activeSlot, { height: v })}
            />
            <FaderRow
              label="See-through"
              value={activeTex.opacity ?? 1}
              accent={DS.ice300}
              readout={pct(activeTex.opacity ?? 1)}
              testId="face-opacity"
              onChange={(v) => setOpacity(activeSlot, v)}
            />
            <div className="text-[8px] font-mono leading-tight" style={{ color: 'var(--ds-text-low)' }}>
              Changes show on the shape instantly.
            </div>
          </>
        ) : (
          <div className="text-[8.5px] font-mono leading-relaxed px-1" style={{ color: 'var(--ds-text-low)' }}>
            Put a picture on a face, then select it here to crop it or make it see-through.
          </div>
        )}
      </div>
    </div>
  );
}
