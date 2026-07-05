'use client';

// P1 TEXT SYSTEM (Task B) — textSpec.fill editor (canvas-spec §7.3/§7.4).
//
// Kind switcher: solid | gradient | texture | ai-texture. Every kind pours
// pigment into the MSDF glyph coverage — letterforms are never generated
// (INV-11). The ai-texture path is honest about its P1 reality:
//   - suggestion swatches are CLIENT-SIDE procedural bakes
//     (src/components/editor/text-fills/procedural-fills.ts, deterministic
//     per prompt, source 'procedural-local');
//   - the cloud endpoint (POST /api/prism/text-fill) is probed once; while it
//     answers { wired: false } (or errors / 404s) an inline note says so.

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, dsAlpha } from '@/components/editor/design-system';
import type { TextFill, TextSpec } from '@/lib/prism-graph/types';
import type { TextFillSuggestion } from '@/lib/prism/text/contract';
import { generateProceduralFills } from '@/components/editor/text-fills/procedural-fills';
import { coerceFill } from './text-tool-helpers';
import { ChipKey, ColorRow, FaderRow, KEY_BG, KEY_SHADOW, SectionLabel, WellInput } from './ui';
import TextFillPreviewStrip from './TextFillPreviewStrip';

const FILL_KINDS: Array<{ kind: TextFill['kind']; label: string }> = [
  { kind: 'solid', label: 'Solid' },
  { kind: 'gradient', label: 'Gradient' },
  { kind: 'texture', label: 'Texture' },
  { kind: 'ai-texture', label: 'AI Fill' },
];

// Logan directive 2026-06-10 (LOGAN-INBOX): 10 candidates per batch, each
// rendered as the user's own selected text in 3D (TextFillPreviewStrip).
const SUGGESTION_COUNT = 10;
const SUGGEST_DEBOUNCE_MS = 350;
const DEFAULT_PROMPT = 'brushed titanium';

/** Bake a suggestion batch. Batch n re-runs the deterministic generator with
 *  a longer index range and keeps the tail — so "Generate more" yields
 *  genuinely new tiles while staying reproducible per (prompt, batch). */
function bakeBatch(prompt: string, batch: number): TextFillSuggestion[] {
  const p = prompt.trim() || DEFAULT_PROMPT;
  return generateProceduralFills(p, SUGGESTION_COUNT * (batch + 1)).slice(
    -SUGGESTION_COUNT,
  );
}

export default function FillEditor({
  fill,
  onChange,
  previewSpec,
}: {
  /** Resolved current fill (effective spec; TEXT_SPEC_DEFAULT supplies one). */
  fill: TextFill;
  onChange: (next: TextFill) => void;
  /** The node's full effective textSpec — when present, AI-fill candidates
   *  render as the user's OWN text in 3D (Logan directive 2026-06-10);
   *  absent, the legacy flat swatch row is used. */
  previewSpec?: TextSpec;
}) {
  // ── AI-texture local state ────────────────────────────────────────────────
  const [batch, setBatch] = useState(0);
  const [suggestions, setSuggestions] = useState<TextFillSuggestion[]>([]);
  const [baking, setBaking] = useState(false);
  // Real fal prompt→texture generation in flight (explicit button only).
  const [aiGen, setAiGen] = useState(false);
  // null = not probed yet; false = unwired (honest note); true = wired.
  const [cloudWired, setCloudWired] = useState<boolean | null>(null);
  const probed = useRef(false);

  const prompt = fill.kind === 'ai-texture' ? fill.prompt : '';

  // Explicit AI generation (cost-gated: real fal fires ONLY on button click, not
  // on every keystroke). Procedural swatches remain the instant live preview.
  const generateAi = async () => {
    if (aiGen) return;
    setAiGen(true);
    try {
      const r = await fetch('/api/prism/text-fill', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: prompt || DEFAULT_PROMPT, count: SUGGESTION_COUNT }),
      });
      const j: { wired?: boolean; suggestions?: TextFillSuggestion[] } = await r.json();
      if (j?.wired && Array.isArray(j.suggestions) && j.suggestions.length > 0) {
        setSuggestions(j.suggestions);
      }
    } catch {
      /* keep the procedural swatches already shown */
    } finally {
      setAiGen(false);
    }
  };

  // Probe the cloud endpoint exactly once, the first time the AI section
  // shows. Non-200 / network error / missing route all count as unwired.
  useEffect(() => {
    if (fill.kind !== 'ai-texture' || probed.current) return;
    probed.current = true;
    let alive = true;
    fetch('/api/prism/text-fill', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: prompt || DEFAULT_PROMPT, probe: true }),
    })
      .then((r) => (r.ok ? r.json() : { wired: false }))
      .then((j: { wired?: boolean }) => {
        if (alive) setCloudWired(j?.wired === true);
      })
      .catch(() => {
        if (alive) setCloudWired(false);
      });
    return () => {
      alive = false;
    };
  }, [fill.kind, prompt]);

  // Debounced procedural bake on prompt / batch change (the bake is a few
  // hundred-k pixel loops + PNG encode — keep it off the keystroke path).
  useEffect(() => {
    if (fill.kind !== 'ai-texture') return;
    setBaking(true);
    const t = setTimeout(() => {
      try {
        setSuggestions(bakeBatch(prompt, batch));
      } catch {
        setSuggestions([]);
      }
      setBaking(false);
    }, SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [fill.kind, prompt, batch]);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Kind switcher */}
      <div className="grid grid-cols-4 gap-1.5">
        {FILL_KINDS.map((k) => (
          <ChipKey
            key={k.kind}
            label={k.label}
            testId={`fill-kind-${k.kind}`}
            active={fill.kind === k.kind}
            onClick={() => {
              if (fill.kind !== k.kind) onChange(coerceFill(k.kind, fill));
            }}
          />
        ))}
      </div>

      {fill.kind === 'solid' && (
        <ColorRow
          label="Color"
          testId="fill-solid-color"
          value={fill.color}
          onChange={(color) => onChange({ kind: 'solid', color })}
        />
      )}

      {fill.kind === 'gradient' && (
        <>
          <ColorRow
            label="From"
            testId="fill-grad-from"
            value={fill.from}
            onChange={(from) => onChange({ ...fill, from })}
          />
          <ColorRow
            label="To"
            testId="fill-grad-to"
            value={fill.to}
            onChange={(to) => onChange({ ...fill, to })}
          />
          <FaderRow
            label="Angle"
            testId="fill-grad-angle"
            value={fill.angleDeg ?? 0}
            min={0}
            max={360}
            step={1}
            format={(v) => `${Math.round(v)}°`}
            onChange={(angleDeg) => onChange({ ...fill, angleDeg })}
          />
        </>
      )}

      {fill.kind === 'texture' && (
        <>
          <WellInput
            value={fill.url}
            testId="fill-texture-url"
            placeholder="Texture URL (poured into the glyph mask)"
            onChange={(url) => onChange({ kind: 'texture', url })}
          />
          <div className="text-[8px] font-mono leading-tight px-1" style={{ color: 'var(--ds-text-low)' }}>
            Any image works — the MSDF coverage stays the alpha mask (INV-11).
          </div>
        </>
      )}

      {fill.kind === 'ai-texture' && (
        <>
          {/* C24 — the prompt-to-edit field was buried behind a 1-letter chip
              with no label. Promote it: an explicit engraved section header +
              wand glyph so it reads as "type a look, get a fill". Editing still
              STAGES through the parent's onChange → usePreviewStateStore
              (FP-15); this only surfaces/labels the control. */}
          <SectionLabel>Generate fill from a prompt</SectionLabel>
          <div className="flex items-center gap-1.5 px-1 -mt-0.5">
            <Icon name="wand" size={10} color={DS.metal300} />
            <span className="text-[8.5px] font-mono leading-tight" style={{ color: 'var(--ds-text-low)' }}>
              Describe a surface — it pours into the glyph mask (never letterforms, INV-11).
            </span>
          </div>
          <WellInput
            value={fill.prompt}
            testId="fill-ai-prompt"
            placeholder='Describe the look — "molten gold", "hairy moss"…'
            onChange={(p) => onChange({ ...fill, prompt: p })}
          />

          {cloudWired === false && (
            <div
              className="px-2 py-1.5 rounded-ds-sm flex items-start gap-1.5"
              style={{
                background: dsAlpha(DS.ice400, 0.1),
                boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.28)}`,
              }}
            >
              <Icon name="sparkle" size={10} color={DS.ice300} />
              <span className="text-[8.5px] font-mono leading-tight" style={{ color: 'var(--ds-text-mid)' }}>
                Cloud generation isn’t wired yet (POST /api/prism/text-fill →
                wired:false). Swatches below are local procedural bakes —
                deterministic, no AI.
              </span>
            </div>
          )}
          {cloudWired === true && (
            <div className="text-[8px] font-mono px-1" style={{ color: 'var(--ds-ok)' }}>
              Cloud wired — “Generate with AI” pours a real prompt→texture onto your text
              (procedural swatches preview instantly while you type).
            </div>
          )}

          {/* Suggestion candidates. With a previewSpec each candidate renders
              as the USER'S OWN selected text in 3D with that texture poured
              into the letterforms (Logan directive 2026-06-10); the flat
              pigment-tile row remains as the spec-less fallback. */}
          <div data-component="ai-fill-suggestions">
            {suggestions.length > 0 && previewSpec ? (
              <TextFillPreviewStrip
                spec={previewSpec}
                candidates={suggestions}
                activeUrl={fill.url}
                onPick={(s) => onChange({ kind: 'ai-texture', prompt: fill.prompt, url: s.url })}
              />
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                {suggestions.map((s) => {
                  const isActive = fill.url === s.url;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      title={`${s.label} (local procedural)`}
                      data-testid="ai-fill-swatch"
                      onClick={() => onChange({ kind: 'ai-texture', prompt: fill.prompt, url: s.url })}
                      className="w-8 h-8 rounded-ds-xs ds-press transition-all hover:brightness-[1.15]"
                      style={{
                        backgroundImage: `url(${s.url})`,
                        backgroundSize: 'cover',
                        boxShadow: isActive
                          ? `inset 0 0 0 2px ${dsAlpha(DS.metal300, 0.9)}, var(--ds-chamfer-soft)`
                          : 'var(--ds-chamfer-soft), 0 1px 2px rgba(0, 0, 0, 0.45)',
                      }}
                    />
                  );
                })}
              </div>
            )}
            {baking && suggestions.length === 0 && (
              <span className="text-[8.5px] font-mono" style={{ color: 'var(--ds-text-low)' }}>
                Baking swatches…
              </span>
            )}
          </div>

          <button
            type="button"
            data-action="ai-fill-generate-more"
            disabled={aiGen}
            onClick={() => (cloudWired === true ? void generateAi() : setBatch((b) => b + 1))}
            className="h-8 rounded-ds-sm flex items-center justify-center gap-1.5 ds-press hover:brightness-[1.15] transition-all disabled:opacity-60"
            style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
          >
            <Icon name={aiGen ? 'sparkle' : 'wand'} size={11} color={DS.text} />
            <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text)' }}>
              {aiGen
                ? 'Generating…'
                : cloudWired === true
                  ? 'Generate with AI'
                  : baking
                    ? 'Baking…'
                    : 'Generate more'}
            </span>
          </button>
          <div className="text-[8px] font-mono leading-tight px-1" style={{ color: 'var(--ds-text-low)' }}>
            Swatches are textures poured into the glyph coverage — never
            letterforms (INV-11).
          </div>
        </>
      )}
    </div>
  );
}
