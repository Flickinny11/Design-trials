'use client';

// ArtifactLibraryPanel — a node's prior artifacts, kept so you can always go
// back (canvas-spec §12.2 outgoing-artifact retention + §11, criterion 20).
//
// The library is append-only: every replacement keeps the old version here.
// This panel shows the current artifact (a highlighted, non-restorable tile)
// above a newest-first list of retired artifacts, each restorable in one tap
// via onRestore. The then-current artifact is retained in turn by the caller —
// this surface never mutates the graph, it only emits the chosen entry.
//
// Chrome: Chrome-Arc (machined KEY faces + recessed wells + engraved
// SectionLabel grooves reused from animation-tools/ui), a tasteful GSAP
// staggered reveal, and native magnetic hover on the Restore keys — both
// skipped under prefers-reduced-motion. No purple; project Icon only;
// plain-language copy with no machine ids or provider names.

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { attachMagnetic } from '@/components/editor/animation-tools/magnetic';
import {
  ChipKey,
  KEY_BG,
  KEY_SHADOW,
  SectionLabel,
  WELL_BG,
  WELL_SHADOW,
} from '@/components/editor/animation-tools/ui';
import type { ArtifactLibraryEntry } from '@/lib/prism-graph/types';
import type { ArtifactLibraryPanelProps } from './wizard-types';

// Plain-language empty-state hint (kept as a constant so the apostrophe stays
// typographic and the string stays greppable — no spec citations).
const EMPTY_HINT =
  'Replacements you make will keep the old version here, so you can always go back.';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** What kind of artifact an entry holds — drives the fallback icon + chip. */
type ArtifactKind = '3d' | 'text' | 'video' | 'image';

function kindOf(entry: ArtifactLibraryEntry): ArtifactKind {
  if (entry.renderMode === 'mesh' || entry.meshUrl) return '3d';
  if (entry.renderMode === 'text' || entry.textSpec) return 'text';
  if (entry.videoUrl) return 'video';
  return 'image';
}

const KIND_ICON: Record<ArtifactKind, string> = {
  '3d': 'cube',
  text: 'text',
  video: 'play',
  image: 'image',
};

const KIND_CHIP: Record<ArtifactKind, string> = {
  '3d': '3D',
  text: 'Text',
  video: 'Video',
  image: 'Image',
};

/** A still image to show in a tile, when the entry carries one. */
function tilePoster(entry: ArtifactLibraryEntry): string | undefined {
  return entry.thumbnailUrl || entry.sourceAsset || undefined;
}

/** Native magnetic hover on a key (reuses animation-tools/magnetic). */
function useMagnetic<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    return attachMagnetic(el, { maxShift: 4, scale: 1.03 });
  }, []);
  return ref;
}

/** Square thumbnail well — poster image when present, else the kind glyph. */
function Thumb({
  entry,
  kind,
  active,
}: {
  entry: ArtifactLibraryEntry;
  kind: ArtifactKind;
  active?: boolean;
}) {
  const poster = tilePoster(entry);
  const tint = active ? DS_ACCENT : DS.ice400;
  return (
    <div
      className="relative shrink-0 w-12 h-12 rounded-ds-xs overflow-hidden flex items-center justify-center"
      style={{
        background: WELL_BG,
        boxShadow: `${WELL_SHADOW}, inset 0 0 0 1px ${dsAlpha(tint, active ? 0.4 : 0.16)}`,
      }}
    >
      {poster ? (
        // Component-side <img> is fine here — this is editor chrome, not the
        // DOM-free runtime path. The renderer textures the real artifact.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <Icon name={KIND_ICON[kind]} size={20} color={tint} glow={active} />
      )}
    </div>
  );
}

/** Tiny kind chip — a quiet ice-tinted pill (informational, never an action). */
function KindChip({ kind }: { kind: ArtifactKind }) {
  return (
    <span
      className="inline-flex items-center px-1.5 h-[15px] rounded-ds-xs text-[8px] font-mono uppercase tracking-[0.12em] whitespace-nowrap"
      style={{
        background: dsAlpha(DS.ice400, 0.1),
        color: DS.ice300,
        boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.22)}`,
      }}
    >
      {KIND_CHIP[kind]}
    </span>
  );
}

export default function ArtifactLibraryPanel({
  entries,
  activeLabel,
  onRestore,
}: ArtifactLibraryPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Newest first reads better — the list is append-only (oldest → newest), so
  // reverse a shallow copy for display without mutating the prop.
  const ordered = [...entries].reverse();

  // Open choreography — staggered reveal, transform/opacity only, killed on
  // unmount, skipped under prefers-reduced-motion (matches ImageFlyout).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const els = root.querySelectorAll('[data-al-reveal]');
    if (els.length === 0) return;
    const tween = gsap.fromTo(
      els,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)', stagger: 0.045 },
    );
    return () => {
      tween.kill();
    };
  }, [ordered.length, activeLabel]);

  return (
    <div ref={rootRef} data-component="artifact-library-panel" className="flex flex-col gap-2.5">
      <SectionLabel>Artifact library</SectionLabel>

      {/* ── Current (active) artifact — highlighted, brass edge, not restorable ── */}
      {activeLabel && (
        <div
          data-al-reveal
          data-control="artifact-library-current"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-ds-sm"
          style={{
            background: `linear-gradient(178deg, ${dsAlpha(DS_ACCENT, 0.14)}, ${dsAlpha(DS_ACCENT, 0.04)}), ${KEY_BG}`,
            boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.5)}, ${KEY_SHADOW}, 0 0 14px ${dsAlpha(DS_ACCENT, 0.14)}`,
          }}
        >
          <div
            className="relative shrink-0 w-12 h-12 rounded-ds-xs overflow-hidden flex items-center justify-center"
            style={{
              background: WELL_BG,
              boxShadow: `${WELL_SHADOW}, inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.45)}`,
            }}
          >
            <Icon name="check" size={20} color={DS.metal200} glow />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <span
              className="text-[8px] font-mono uppercase tracking-[0.18em]"
              style={{ color: DS.metal300 }}
            >
              In use now
            </span>
            <span
              className="text-[10.5px] font-mono font-semibold leading-snug break-words"
              style={{ color: 'var(--ds-text-hi)' }}
            >
              {activeLabel}
            </span>
          </div>
        </div>
      )}

      {/* ── Retired artifacts — newest first, each restorable ─────────────────── */}
      {ordered.length > 0 ? (
        <div
          data-control="artifact-library-list"
          className="flex flex-col gap-1.5 overflow-y-auto pr-0.5"
          style={{ maxHeight: '248px' }}
        >
          {ordered.map((entry) => (
            <ArtifactTile key={entry.id} entry={entry} onRestore={onRestore} />
          ))}
        </div>
      ) : (
        <div
          data-al-reveal
          data-control="artifact-library-empty"
          className="flex items-start gap-2 px-2.5 py-3 rounded-ds-sm"
          style={{
            background: WELL_BG,
            boxShadow: WELL_SHADOW,
            border: `1px dashed ${dsAlpha(DS.ice400, 0.2)}`,
          }}
        >
          <Icon name="layers" size={14} color={DS.ice400} />
          <span
            className="text-[9.5px] font-mono leading-relaxed"
            style={{ color: 'var(--ds-text-mid)' }}
          >
            {EMPTY_HINT}
          </span>
        </div>
      )}
    </div>
  );
}

// ── One retired-artifact tile — thumbnail + label + kind chip + Restore key ──
function ArtifactTile({
  entry,
  onRestore,
}: {
  entry: ArtifactLibraryEntry;
  onRestore: (entry: ArtifactLibraryEntry) => void;
}) {
  const restoreRef = useMagnetic<HTMLDivElement>();
  const kind = kindOf(entry);
  const label = entry.label || `${KIND_CHIP[kind]} version`;

  return (
    <div
      data-al-reveal
      data-control="artifact-library-entry"
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-ds-sm transition-all hover:brightness-[1.06]"
      style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
    >
      <Thumb entry={entry} kind={kind} />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <span
          className="text-[10px] font-mono leading-snug break-words"
          style={{ color: 'var(--ds-text)' }}
        >
          {label}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <KindChip kind={kind} />
        </div>
      </div>
      <div ref={restoreRef} className="shrink-0">
        <ChipKey
          label="Restore"
          accent={DS_ACCENT}
          title="Bring this version back"
          testId="artifact-library-restore"
          onClick={() => onRestore(entry)}
        />
      </div>
    </div>
  );
}
