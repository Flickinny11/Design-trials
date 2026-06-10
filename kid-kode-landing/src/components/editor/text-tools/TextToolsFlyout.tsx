'use client';

// P1 TEXT SYSTEM (Task B) — the Text toolbar group flyout
// (canvas-spec §5 Text tools + §7.2–7.5).
//
// Wiring contract:
//   - STRUCTURAL creation (Add Text) goes through
//     useGraphSourceStore.getState().addNode(buildTextNode(...)) — the node
//     builder is owned by src/lib/prism/text/create-text-node.ts; this file
//     never builds its own node shape.
//   - LIVE styling edits route through usePreviewStateStore (FP-15 / SC-072
//     routing — the same path MaterialTab uses). This file NEVER calls
//     useGraphSourceStore.getState().updateNode. The renderer reads
//     source ⊕ preview overlay, so textSpec writes restyle in real time once
//     the scene-side consumer handles the textSpec case (criterion 26).
//   - Fonts: full library via getFontRegistry().listFonts(); picking a
//     family/weight resolves its atlas (non-core → on-demand server bake,
//     cached — criterion 27) with a visible loading state.
//
// Gating mirrors the wired Lighting group: the toolbar renders only in
// canvas mode; Add Text needs a current hub; the styling controls need the
// selection to be a renderMode:'text' node (otherwise a contextual hint).

import { useEffect, useState } from 'react';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT } from '@/components/editor/design-system';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { usePreviewStateStore } from '@/stores/usePreviewStateStore';
import { buildTextNode } from '@/lib/prism/text/create-text-node';
import { getFontRegistry } from '@/lib/prism/text/font-registry';
import type { FontManifestEntry } from '@/lib/prism/text/contract';
import type {
  PrismHub,
  PrismNode,
  TextGlowSpec,
  TextOutlineSpec,
  TextShadowSpec,
  TextSpec,
} from '@/lib/prism-graph/types';
import { TEXT_SPEC_DEFAULT } from '@/lib/prism-graph/types';
import {
  TEXT_PRESETS,
  applyPreset,
  clampWeight,
  effectiveTextSpec,
  rawTextSpec,
  weightsFor,
} from './text-tool-helpers';
import FontPicker from './FontPicker';
import FillEditor from './FillEditor';
import TextAnimationPicker from './TextAnimationPicker';
import {
  ChipKey,
  ColorRow,
  FaderRow,
  KEY_BG,
  KEY_SHADOW,
  SectionLabel,
  activeKeyStyle,
} from './ui';

// Effect DATA defaults shown in the inputs before the user opts in — scene
// pigments (textSpec data), sanctioned-hex exception like LIGHT_COLOR_DEFAULT.
const OUTLINE_COLOR_DEFAULT = '#10131a';
const GLOW_COLOR_DEFAULT = '#ffd86b';
const SHADOW_COLOR_DEFAULT = '#000000';

const ALIGNS: Array<NonNullable<TextSpec['align']>> = ['left', 'center', 'right'];
const DECOMPOSES: Array<NonNullable<TextSpec['decompose']>> = ['glyph', 'word', 'line'];

export default function TextToolsFlyout({
  node,
  hub,
  onToast,
}: {
  /** Currently selected node (or null). */
  node: PrismNode | null;
  /** Active hub resolution shared with the Lighting group (active hub →
   *  selected node's parent hub → first hub). Add Text tethers here. */
  hub: PrismHub | null;
  onToast: (msg: string) => void;
}) {
  // `renderMode: 'text'` is the text-node discriminator. Compared via string
  // so this file is independent of the exact RenderMode union revision (the
  // 'text' literal is added by the concurrent schema work, additively).
  const isTextNode = !!node && (node.renderMode as string | undefined) === 'text';

  // ── Preview overlay subscription (re-renders on live edits) ───────────────
  const previewTextSpec = usePreviewStateStore((s) =>
    node ? s.patches[node.nodeId]?.textSpec : undefined,
  );
  const eff = effectiveTextSpec(node?.textSpec, previewTextSpec);

  // FP-15 routing: every styling write lands on the preview buffer (whole
  // textSpec sub-object replacement) — NEVER source-store updateNode.
  const writeWhole = (next: TextSpec) => {
    if (!node) return;
    usePreviewStateStore.getState().set(node.nodeId, { textSpec: next });
  };
  const write = (patch: Partial<TextSpec>) => {
    if (!node) return;
    writeWhole({ ...rawTextSpec(node.textSpec, previewTextSpec), ...patch });
  };
  const patchOutline = (p: Partial<TextOutlineSpec>) =>
    write({ outline: { color: OUTLINE_COLOR_DEFAULT, width: 0, ...(eff.outline ?? {}), ...p } });
  const patchGlow = (p: Partial<TextGlowSpec>) =>
    write({ glow: { color: GLOW_COLOR_DEFAULT, intensity: 0, ...(eff.glow ?? {}), ...p } });
  const patchShadow = (p: Partial<TextShadowSpec>) =>
    write({
      shadow: {
        color: SHADOW_COLOR_DEFAULT,
        offsetX: 0.04,
        offsetY: -0.04,
        opacity: 0,
        ...(eff.shadow ?? {}),
        ...p,
      },
    });

  // ── Font library + atlas resolution (criterion 27) ────────────────────────
  const [fonts, setFonts] = useState<FontManifestEntry[] | null>(null);
  const [fontsError, setFontsError] = useState<string | null>(null);
  const [resolvingFont, setResolvingFont] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getFontRegistry()
      .listFonts()
      .then((f) => {
        if (alive) setFonts(f);
      })
      .catch((e: unknown) => {
        if (alive) setFontsError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const resolveAtlasWithStatus = (family: string, weight: number, core: boolean) => {
    setResolvingFont(family);
    getFontRegistry()
      .resolveAtlas(family, weight)
      .then(() => {
        onToast(core ? `${family} ready` : `${family} ${weight} baked + cached`);
      })
      .catch(() => {
        onToast(`${family}: atlas failed to load`);
      })
      .finally(() => {
        setResolvingFont((cur) => (cur === family ? null : cur));
      });
  };

  const pickFont = (entry: FontManifestEntry) => {
    if (!node) return;
    const weight = clampWeight(entry.weights, eff.fontWeight ?? 400);
    write({ fontFamily: entry.family, fontWeight: weight });
    // Resolve the atlas now so the restyle is instant once rendered. Non-core
    // selections trigger the on-demand server bake (which caches) —
    // criterion 27. Core resolves are a cheap static-asset warm.
    resolveAtlasWithStatus(entry.family, weight, entry.core);
  };

  const pickWeight = (weight: number) => {
    if (!node) return;
    write({ fontWeight: weight });
    const family = eff.fontFamily ?? TEXT_SPEC_DEFAULT.fontFamily ?? 'Inter';
    const entry = fonts?.find((f) => f.family === family);
    // A new weight needs its own atlas pair — resolve (bakes + caches when
    // not pre-baked; core families are only pre-baked at 400).
    resolveAtlasWithStatus(family, weight, (entry?.core ?? false) && weight === 400);
  };

  // ── Add Text (structural — source-store addNode is the sanctioned path) ───
  const doAddText = () => {
    if (!hub) return;
    const id = useGraphSourceStore
      .getState()
      .addNode(buildTextNode({ parentHubId: hub.hubId, content: 'Text' }));
    useGraphEditorStore.getState().selectNode(id);
    onToast(`Text added to ${hub.title ?? hub.hubId}`);
  };

  const availableWeights = weightsFor(fonts, eff.fontFamily ?? 'Inter');

  return (
    <>
      {/* Add Text — always available (needs a hub in view). */}
      <button
        type="button"
        data-action="add-text"
        disabled={!hub}
        onClick={doAddText}
        className={`w-full h-9 rounded-ds-sm flex items-center justify-center gap-2 ds-press transition-all ${
          hub ? 'hover:brightness-[1.12]' : 'opacity-40 cursor-not-allowed'
        }`}
        style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
      >
        <Icon name="plus" size={12} color={DS_ACCENT} />
        <span className="text-[11px] font-mono" style={{ color: 'var(--ds-text)' }}>
          Add Text{hub ? ` · ${hub.title ?? hub.hubId}` : ''}
        </span>
      </button>
      <div className="text-[8px] font-mono leading-tight -mt-1 px-1" style={{ color: 'var(--ds-text-low)' }}>
        Creates an MSDF text node tethered to the current hub. Real glyphs,
        always (INV-11).
      </div>

      {!isTextNode ? (
        <div className="flex flex-col items-center text-center gap-2 py-3 px-2">
          <div className="w-9 h-9 ds-well flex items-center justify-center">
            <Icon name="text" size={16} color={DS.textMid} />
          </div>
          <span className="text-[9.5px] font-mono leading-relaxed" style={{ color: 'var(--ds-text-low)' }}>
            {node
              ? 'Selected element is not a text node — select one (or Add Text) to style type, fills, and effects.'
              : 'Select a text node on the canvas (or Add Text) to style type, fills, and effects.'}
          </span>
        </div>
      ) : (
        <>
          {/* Selection chip */}
          <div className="flex items-center gap-2 px-2.5 py-2 ds-well">
            <Icon name="text" size={12} color={DS_ACCENT} />
            <span className="flex-1 text-[10px] font-mono truncate" style={{ color: 'var(--ds-text)' }}>
              {node?.intent?.caption?.split(' · ')[0] || node?.subtype || node?.nodeId}
            </span>
            <span className="ds-chip ds-chip--brass">TEXT</span>
          </div>

          {/* Content */}
          <SectionLabel>Content · live preview</SectionLabel>
          <textarea
            data-control="text-content"
            value={eff.content ?? ''}
            onChange={(e) => write({ content: e.target.value })}
            rows={2}
            className="w-full px-2.5 py-1.5 rounded-ds-xs text-[10px] font-mono outline-none resize-y"
            style={{
              background: 'var(--ds-grad-well)',
              boxShadow:
                'inset 0 2px 5px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(255, 252, 242, 0.05)',
              color: 'var(--ds-text-hi)',
              border: '1px solid rgba(255, 252, 242, 0.07)',
            }}
          />

          {/* Font */}
          <SectionLabel>Font · {fonts ? `${fonts.length} families` : 'loading'}</SectionLabel>
          <FontPicker
            fonts={fonts}
            fontsError={fontsError}
            family={eff.fontFamily ?? 'Inter'}
            resolving={resolvingFont}
            onPick={pickFont}
          />
          <label className="flex items-center justify-between px-2.5 py-2 ds-well">
            <span className="text-[10px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>
              Weight
            </span>
            <select
              data-control="text-weight"
              value={eff.fontWeight ?? 400}
              onChange={(e) => pickWeight(parseInt(e.target.value, 10))}
              className="bg-transparent text-[10px] font-mono outline-none cursor-pointer"
              style={{ color: 'var(--ds-text-hi)' }}
            >
              {availableWeights.map((w) => (
                <option
                  key={w}
                  value={w}
                  style={{ background: 'var(--ds-charcoal)', color: 'var(--ds-text-hi)' }}
                >
                  {w}
                </option>
              ))}
            </select>
          </label>

          {/* Type metrics */}
          <SectionLabel>Type · writes textSpec</SectionLabel>
          <FaderRow
            label="Size"
            testId="text-size"
            value={eff.fontSize ?? 0.4}
            min={0.08}
            max={1.5}
            step={0.01}
            onChange={(fontSize) => write({ fontSize })}
          />
          <FaderRow
            label="Letter Spacing"
            testId="text-letter-spacing"
            value={eff.letterSpacing ?? 0}
            min={-0.1}
            max={0.5}
            step={0.005}
            accent={DS.brass300}
            onChange={(letterSpacing) => write({ letterSpacing })}
          />
          <FaderRow
            label="Line Height"
            testId="text-line-height"
            value={eff.lineHeight ?? 1}
            min={0.5}
            max={2.5}
            step={0.05}
            accent={DS.brass300}
            onChange={(lineHeight) => write({ lineHeight })}
          />
          <FaderRow
            label="Opacity"
            testId="text-opacity"
            value={eff.opacity ?? 1}
            min={0}
            max={1}
            step={0.01}
            accent={DS.ice300}
            onChange={(opacity) => write({ opacity })}
          />

          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono w-12" style={{ color: 'var(--ds-text-low)' }}>
              Align
            </span>
            <div className="grid grid-cols-3 gap-1.5 flex-1">
              {ALIGNS.map((a) => (
                <ChipKey
                  key={a}
                  label={a}
                  testId={`text-align-${a}`}
                  active={(eff.align ?? 'center') === a}
                  onClick={() => write({ align: a })}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono w-12" style={{ color: 'var(--ds-text-low)' }}>
              Units
            </span>
            <div className="grid grid-cols-3 gap-1.5 flex-1">
              {DECOMPOSES.map((d) => (
                <ChipKey
                  key={d}
                  label={d}
                  testId={`text-decompose-${d}`}
                  active={(eff.decompose ?? 'glyph') === d}
                  accent={DS.ice300}
                  onClick={() => write({ decompose: d })}
                  title="Animation unit granularity (text primitives animate per unit)"
                />
              ))}
            </div>
          </div>

          {/* Fill */}
          <SectionLabel>Fill · pigment in the glyph mask</SectionLabel>
          <FillEditor
            fill={eff.fill ?? { kind: 'solid', color: '#e8e4da' }}
            onChange={(fill) => write({ fill })}
            previewSpec={eff}
          />

          {/* Outline */}
          <SectionLabel>Outline</SectionLabel>
          <ColorRow
            label="Color"
            testId="outline-color"
            value={eff.outline?.color ?? OUTLINE_COLOR_DEFAULT}
            onChange={(color) => patchOutline({ color })}
          />
          <FaderRow
            label="Width"
            testId="outline-width"
            value={eff.outline?.width ?? 0}
            min={0}
            max={1}
            step={0.01}
            onChange={(width) => patchOutline({ width })}
          />

          {/* Glow */}
          <SectionLabel>Glow</SectionLabel>
          <ColorRow
            label="Color"
            testId="glow-color"
            value={eff.glow?.color ?? GLOW_COLOR_DEFAULT}
            onChange={(color) => patchGlow({ color })}
          />
          <FaderRow
            label="Intensity"
            testId="glow-intensity"
            value={eff.glow?.intensity ?? 0}
            min={0}
            max={4}
            step={0.05}
            onChange={(intensity) => patchGlow({ intensity })}
          />

          {/* Shadow */}
          <SectionLabel>Shadow</SectionLabel>
          <ColorRow
            label="Color"
            testId="shadow-color"
            value={eff.shadow?.color ?? SHADOW_COLOR_DEFAULT}
            onChange={(color) => patchShadow({ color })}
          />
          <FaderRow
            label="Offset X"
            testId="shadow-offset-x"
            value={eff.shadow?.offsetX ?? 0.04}
            min={-0.3}
            max={0.3}
            step={0.01}
            onChange={(offsetX) => patchShadow({ offsetX })}
          />
          <FaderRow
            label="Offset Y"
            testId="shadow-offset-y"
            value={eff.shadow?.offsetY ?? -0.04}
            min={-0.3}
            max={0.3}
            step={0.01}
            onChange={(offsetY) => patchShadow({ offsetY })}
          />
          <FaderRow
            label="Opacity"
            testId="shadow-opacity"
            value={eff.shadow?.opacity ?? 0}
            min={0}
            max={1}
            step={0.01}
            onChange={(opacity) => patchShadow({ opacity })}
          />

          {/* Presets */}
          <SectionLabel>Presets · merge onto spec</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {TEXT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                data-preset={p.id}
                onClick={() => {
                  writeWhole(applyPreset(rawTextSpec(node?.textSpec, previewTextSpec), p));
                  onToast(`Preset · ${p.label}`);
                }}
                className="h-8 px-2 rounded-ds-sm ds-press hover:brightness-[1.15] transition-all text-left"
                style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
              >
                <span className="text-[9px] font-mono" style={{ color: 'var(--ds-text)' }}>
                  {p.label}
                </span>
              </button>
            ))}
          </div>
          <div className="text-[8px] font-mono leading-tight px-1" style={{ color: 'var(--ds-text-low)' }}>
            P1 chip row — the full hover-play preset gallery (§7.5) is backlog.
          </div>

          {/* Text animation picker (surface only — binds in P2) */}
          <SectionLabel>Text Animation</SectionLabel>
          <TextAnimationPicker />

          {/* Edit-state hint, mirroring the other wired groups' honesty. */}
          {previewTextSpec && (
            <div
              className="px-2 py-1.5 rounded-ds-sm flex items-center gap-1.5"
              style={activeKeyStyle(DS_ACCENT)}
            >
              <Icon name="edit" size={10} color={DS_ACCENT} />
              <span className="text-[8.5px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>
                Live preview edits — Save in the Inspector commits to source.
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}
