'use client';

// ModelPicker — the Change Artifact wizard's generator / quality picker
// (canvas-spec §12.2). The user chooses which Prism generator runs for this
// artifact; each row shows what it does and what it costs in credits. The
// catalog arrives already filtered to the relevant kind by the caller, so this
// component only decides between same-kind generators (or, when the rows differ
// only by quality, between quality tiers).
//
// Chrome: Observatory Brass — the same machined treatments the toolbar flyouts
// use (recessed WELL rows, brass active-key state from animation-tools/ui,
// engraved SectionLabel groove). GSAP staggers the rows in on open; native
// magnetic hover lifts the active-ish rows. Both honor prefers-reduced-motion.
// No purple; project Icon component only; plain-language copy with no provider
// names or machine ids.

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { attachMagnetic } from '@/components/editor/animation-tools/magnetic';
import {
  KEY_BG,
  KEY_SHADOW,
  SectionLabel,
  WELL_BG,
  WELL_SHADOW,
  activeKeyStyle,
} from '@/components/editor/animation-tools/ui';
import type { ModelPickerProps } from './wizard-types';
import type { MediaKind } from '@/lib/editor/media-gen-client';

// Plain-language icon per kind — drawn from the project Icon set only.
const KIND_ICON: Record<MediaKind, string> = {
  image: 'image',
  mesh: 'cube',
  video: 'play',
  edit: 'wand',
  code: 'code',
};

// What the picker is choosing, in plain words, when the rows are generators of
// the same kind (e.g. "Picture generator", "Model generator").
const KIND_NOUN: Record<MediaKind, string> = {
  image: 'Picture',
  mesh: 'Model',
  video: 'Video',
  edit: 'Edit',
  code: 'Code',
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Native magnetic hover on a row (reuses animation-tools/magnetic, same as the
 *  flyouts). Disabled under prefers-reduced-motion. */
function useMagnetic<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || prefersReducedMotion()) return;
    return attachMagnetic(el, { maxShift: 4, scale: 1.02 });
  }, [enabled]);
  return ref;
}

const creditWord = (n: number) => `${n} ${n === 1 ? 'credit' : 'credits'}`;

// A brass credit pill — recessed WELL trough, brass text. Shown on every row so
// the cost is always visible.
function CreditBadge({ credits }: { credits: number }) {
  return (
    <span
      className="shrink-0 text-[8.5px] font-mono tabular-nums px-1.5 py-0.5 rounded-ds-xs whitespace-nowrap"
      style={{ color: DS.brass200, background: WELL_BG, boxShadow: WELL_SHADOW }}
    >
      {creditWord(credits)}
    </span>
  );
}

// One selectable generator/quality row. Label (bold), blurb (small mono,
// --ds-text-mid), credit badge on the right. Active = brass key face.
function ModelRow({
  label,
  blurb,
  quality,
  credits,
  active,
  iconName,
  onSelect,
}: {
  label: string;
  blurb: string;
  quality?: string;
  credits: number;
  active: boolean;
  iconName: string;
  onSelect: () => void;
}) {
  const ref = useMagnetic<HTMLButtonElement>(!active);
  return (
    <button
      ref={ref}
      type="button"
      data-control="model-picker-row"
      data-model-active={active || undefined}
      aria-pressed={active}
      onClick={onSelect}
      className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-ds-sm text-left ds-press transition-all ${
        active ? '' : 'hover:brightness-[1.12]'
      }`}
      style={
        active
          ? { ...activeKeyStyle(DS_ACCENT), color: 'var(--ds-text-hi)' }
          : { background: KEY_BG, boxShadow: KEY_SHADOW, color: 'var(--ds-text)' }
      }
    >
      <Icon
        name={iconName}
        size={15}
        color={active ? DS.brass200 : DS.textMid}
        glow={active}
      />
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[10.5px] font-mono font-semibold truncate"
            style={{ color: active ? 'var(--ds-brass-200)' : 'var(--ds-text-hi)' }}
          >
            {label}
          </span>
          {quality && (
            <span
              className="shrink-0 text-[7.5px] font-mono uppercase tracking-[0.14em] px-1 py-px rounded-ds-xs"
              style={{
                color: 'var(--ds-text-mid)',
                background: dsAlpha(DS.ice400, 0.12),
                boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.22)}`,
              }}
            >
              {quality}
            </span>
          )}
        </span>
        <span
          className="text-[8.5px] font-mono leading-snug line-clamp-2"
          style={{ color: 'var(--ds-text-mid)' }}
        >
          {blurb}
        </span>
      </span>
      <CreditBadge credits={credits} />
      {active && (
        <Icon name="check" size={11} color={DS.brass200} glow />
      )}
    </button>
  );
}

// A single, non-selectable row — used when there's exactly one generator. The
// cost still needs to be visible, so we render it as a static info plate.
function SingleInfoRow({
  label,
  blurb,
  quality,
  credits,
  iconName,
}: {
  label: string;
  blurb: string;
  quality?: string;
  credits: number;
  iconName: string;
}) {
  return (
    <div
      data-control="model-picker-single"
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-ds-sm"
      style={{ background: WELL_BG, boxShadow: WELL_SHADOW }}
    >
      <Icon name={iconName} size={15} color={DS.brass300} />
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[10.5px] font-mono font-semibold truncate"
            style={{ color: 'var(--ds-text-hi)' }}
          >
            {label}
          </span>
          {quality && (
            <span
              className="shrink-0 text-[7.5px] font-mono uppercase tracking-[0.14em] px-1 py-px rounded-ds-xs"
              style={{
                color: 'var(--ds-text-mid)',
                background: dsAlpha(DS.ice400, 0.12),
                boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.22)}`,
              }}
            >
              {quality}
            </span>
          )}
        </span>
        <span
          className="text-[8.5px] font-mono leading-snug line-clamp-2"
          style={{ color: 'var(--ds-text-mid)' }}
        >
          {blurb}
        </span>
      </span>
      <CreditBadge credits={credits} />
    </div>
  );
}

export default function ModelPicker({ models, selectedId, onSelect, kind }: ModelPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // The picker is a "Quality" picker when every row is the same kind and they
  // differ only by quality tier (and at least two carry an explicit quality);
  // otherwise it's a "Generator" picker. (Single-row case still labels by the
  // generator's purpose.)
  const qualities = models.map((m) => m.quality).filter(Boolean);
  const distinctQualities = new Set(qualities);
  const isQualityPicker =
    models.length > 1 &&
    distinctQualities.size > 1 &&
    qualities.length === models.length;

  const iconName = KIND_ICON[kind] ?? 'sparkle';
  const heading = isQualityPicker ? 'Quality' : `${KIND_NOUN[kind] ?? 'Generator'} generator`;

  // Entrance: stagger the rows in, transform/opacity only, killed on unmount,
  // skipped under prefers-reduced-motion (matches ImageFlyout).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const els = root.querySelectorAll('[data-mp-reveal]');
    if (els.length === 0) return;
    const tween = gsap.fromTo(
      els,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)', stagger: 0.05 },
    );
    return () => {
      tween.kill();
    };
  }, [models.length]);

  if (models.length === 0) {
    return (
      <div ref={rootRef} data-component="model-picker" className="flex flex-col">
        <SectionLabel>{heading}</SectionLabel>
        <div
          data-mp-reveal
          className="text-[8.5px] font-mono leading-relaxed px-1 py-2"
          style={{ color: 'var(--ds-text-low)' }}
        >
          No generators are available for this right now.
        </div>
      </div>
    );
  }

  // Single generator → static info row (no picker, but the cost stays visible).
  if (models.length <= 1) {
    const m = models[0];
    return (
      <div ref={rootRef} data-component="model-picker" className="flex flex-col">
        <SectionLabel>{heading}</SectionLabel>
        <div data-mp-reveal>
          <SingleInfoRow
            label={m.label}
            blurb={m.blurb}
            quality={m.quality}
            credits={m.credits}
            iconName={iconName}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} data-component="model-picker" className="flex flex-col">
      <SectionLabel>{heading}</SectionLabel>
      <div className="flex flex-col gap-1.5">
        {models.map((m) => (
          <div key={m.id} data-mp-reveal>
            <ModelRow
              label={m.label}
              blurb={m.blurb}
              quality={m.quality}
              credits={m.credits}
              active={m.id === selectedId}
              iconName={iconName}
              onSelect={() => onSelect(m.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
