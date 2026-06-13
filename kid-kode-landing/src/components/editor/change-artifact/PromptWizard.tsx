'use client';

// CANVAS-FINAL — Change Artifact PROMPT wizard (canvas-spec §12.2, criterion 20).
// Tabs Image / 3D / Video / Code; a prompt box + up to 4 multi-view slots; an
// interactive result viewport (3D is orbitable); result actions Use This /
// Change This → Modify This / From Scratch. Generation runs through the Prism
// Media Generator (never surfaces the backing provider); each model shows its
// credit cost.

import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import {
  ChipKey,
  SectionLabel,
  WELL_BG,
  WELL_SHADOW,
  activeKeyStyle,
} from '@/components/editor/animation-tools/ui';
import {
  fetchMediaCatalog,
  generateMedia,
  uploadArtifactFile,
  type GenerateKind,
  type MediaGenError,
  type MediaGenResult,
  type MediaKind,
  type PrismModelPublic,
  type CreditMeter,
} from '@/lib/editor/media-gen-client';
import { applyArtifactSwap } from '@/lib/editor/apply-artifact';
import type { ArtifactPayload } from '@/lib/editor/artifact-library';
import type { PrismNode } from '@/lib/prism-graph/types';
import WizardWindow from './WizardWindow';
import Glb3DPreview from './Glb3DPreview';
import ModelPicker from './ModelPicker';

type Tab = 'image' | '3d' | 'video' | 'code';

const TABS: Array<{ id: Tab; label: string; icon: string; kind: MediaKind; gen: GenerateKind }> = [
  { id: 'image', label: 'Image', icon: 'image', kind: 'image', gen: 'image' },
  { id: '3d', label: '3D object', icon: 'cube', kind: 'mesh', gen: '3d' },
  { id: 'video', label: 'Video', icon: 'play', kind: 'video', gen: 'video' },
  { id: 'code', label: 'Code', icon: 'sparkle', kind: 'code', gen: 'code' },
];

const VIEW_LABELS = ['Front', 'Back', 'Left', 'Right'];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export default function PromptWizard({ node, onClose, onBack }: { node: PrismNode; onClose: () => void; onBack?: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<Tab>('image');
  const [prompt, setPrompt] = useState('');
  const [quality, setQuality] = useState<'standard' | 'studio'>('standard');
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null]);
  const [catalog, setCatalog] = useState<PrismModelPublic[]>([]);
  const [meter, setMeter] = useState<CreditMeter>({ used: 0, generations: 0 });
  const [busy, setBusy] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [result, setResult] = useState<MediaGenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyPrompt, setModifyPrompt] = useState('');

  const nodeImageUrl = node.visual?.sourceAsset;
  const activeTab = TABS.find((t) => t.id === tab)!;
  const tabModels = useMemo(
    () => catalog.filter((m) => m.kind === activeTab.kind),
    [catalog, activeTab.kind],
  );
  const selectedModel = useMemo(() => {
    if (tab === 'image') return tabModels.find((m) => m.quality === quality) ?? tabModels[0];
    return tabModels[0];
  }, [tabModels, tab, quality]);

  useEffect(() => {
    let alive = true;
    void fetchMediaCatalog().then((c) => {
      if (!alive) return;
      setCatalog(c.catalog);
      setMeter(c.meter);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Entrance choreography (transform/opacity only; respects reduced motion).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const els = root.querySelectorAll('[data-pw-reveal]');
    if (!els.length) return;
    const tween = gsap.fromTo(
      els,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)', stagger: 0.04 },
    );
    return () => {
      tween.kill();
    };
  }, []);

  // Reset transient state when switching tabs.
  const switchTab = (next: Tab) => {
    setTab(next);
    setResult(null);
    setError(null);
    setModifyOpen(false);
  };

  const handleSlotFile = async (i: number, files: FileList | File[] | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadingSlot(i);
    setError(null);
    try {
      const up = await uploadArtifactFile(file);
      setSlots((s) => s.map((v, idx) => (idx === i ? up.url : v)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That picture could not be uploaded.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const clearSlot = (i: number) => setSlots((s) => s.map((v, idx) => (idx === i ? null : v)));

  const filledSlots = slots.filter((s): s is string => !!s);

  const canGenerate = (() => {
    if (busy) return false;
    if (tab === 'image' || tab === 'code') return prompt.trim().length > 0;
    if (tab === '3d') return filledSlots.length > 0 || !!nodeImageUrl;
    if (tab === 'video') return !!slots[0] || !!nodeImageUrl;
    return false;
  })();

  const runGenerate = async () => {
    if (!canGenerate) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let res: MediaGenResult | MediaGenError;
      if (tab === 'image') {
        res = await generateMedia({ kind: 'image', prompt: prompt.trim(), quality, count: 1, imageUrl: slots[0] ?? undefined });
      } else if (tab === '3d') {
        const inputs = filledSlots.length > 0 ? filledSlots : nodeImageUrl ? [nodeImageUrl] : [];
        res = await generateMedia({ kind: '3d', imageUrls: inputs, prompt: prompt.trim() || undefined });
      } else if (tab === 'video') {
        const start = slots[0] ?? nodeImageUrl;
        res = await generateMedia({ kind: 'video', imageUrl: start ?? undefined, prompt: prompt.trim() || undefined });
      } else {
        res = await generateMedia({ kind: 'code', prompt: prompt.trim() });
      }
      if (res.ok) {
        setResult(res);
        setMeter(res.meter);
      } else {
        setError('error' in res ? res.error : 'Generation could not be completed.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const runModify = async () => {
    if (!result || busy || !modifyPrompt.trim()) return;
    const srcImg = result.images?.[0]?.url;
    if (!srcImg) {
      // Non-image: re-run the same kind with the tweaked prompt prefilled.
      setPrompt(modifyPrompt.trim());
      setModifyOpen(false);
      void runGenerate();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await generateMedia({ kind: 'edit', imageUrl: srcImg, prompt: modifyPrompt.trim() });
      if (res.ok) {
        setResult(res);
        setMeter(res.meter);
        setModifyOpen(false);
        setModifyPrompt('');
      } else {
        setError('error' in res ? res.error : 'Generation could not be completed.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change could not be applied.');
    } finally {
      setBusy(false);
    }
  };

  const fromScratch = () => {
    setResult(null);
    setError(null);
    setModifyOpen(false);
    setModifyPrompt('');
  };

  const useThis = () => {
    if (!result) return;
    const name = node.intent?.caption?.split(' · ')[0] || node.subtype || 'element';
    let payload: ArtifactPayload | null = null;
    if (result.kind === 'image' && result.images?.[0]) {
      payload = { kind: 'image', source: 'generated', imageUrl: result.images[0].url, prompt: prompt.trim() || undefined, label: `${name} · image` };
    } else if (result.kind === 'edit' && result.images?.[0]) {
      payload = { kind: 'image', source: 'generated', imageUrl: result.images[0].url, prompt: modifyPrompt.trim() || prompt.trim() || undefined, label: `${name} · image` };
    } else if (result.kind === '3d' && result.meshUrl) {
      payload = { kind: 'mesh-glb', source: 'generated', meshUrl: result.meshUrl, thumbnailUrl: result.previewUrl, prompt: prompt.trim() || undefined, label: `${name} · 3D model` };
    } else if (result.kind === 'video' && result.videoUrl) {
      payload = { kind: 'video', source: 'generated', videoUrl: result.videoUrl, posterUrl: result.posterUrl, prompt: prompt.trim() || undefined, label: `${name} · video` };
    } else if (result.kind === 'code' && result.compose) {
      const c = result.compose;
      payload = {
        kind: 'mesh-primitive',
        source: 'generated',
        meshPrimitive: c.meshPrimitive as ArtifactPayload['meshPrimitive'],
        materialSpec: c.materialSpec as ArtifactPayload['materialSpec'],
        animationBindings: (c.animationBindings as ArtifactPayload['animationBindings']) ?? undefined,
        prompt: prompt.trim() || undefined,
        label: `${name} · shape`,
      };
    }
    if (payload) {
      applyArtifactSwap(node.nodeId, payload);
      onClose();
    }
  };

  const showSlots = tab === '3d' || tab === 'video' || tab === 'image';
  const slotHint =
    tab === '3d'
      ? 'Add 1–4 views of the same object (front is enough). Prism builds a real 3D model.'
      : tab === 'video'
        ? 'Add the starting picture (or it uses this element’s current image).'
        : 'Optional: add a reference picture to guide the style.';

  const footer = (
    <>
      {result ? (
        <>
          <button type="button" data-role="prompt-from-scratch" onClick={fromScratch} className="ds-btn ds-btn--quiet ds-press">
            From scratch
          </button>
          <button
            type="button"
            data-role="prompt-modify"
            onClick={() => setModifyOpen((v) => !v)}
            className="ds-btn ds-btn--quiet ds-press"
          >
            Change this
          </button>
          <button type="button" data-role="prompt-use-this" onClick={useThis} className="ds-btn ds-btn--primary ds-press">
            Use this
          </button>
        </>
      ) : (
        <>
          <span className="text-[10px] font-mono mr-auto" style={{ color: 'var(--ds-text-low)' }}>
            {selectedModel ? `Uses ${selectedModel.credits} credits` : ''}
            {meter.generations > 0 ? `  ·  ${meter.used} used this session` : ''}
          </span>
          <button
            type="button"
            data-role="prompt-generate"
            disabled={!canGenerate}
            onClick={() => void runGenerate()}
            className="ds-btn ds-btn--primary ds-press"
            style={canGenerate ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </>
      )}
    </>
  );

  return (
    <WizardWindow title="Generate an artifact" kicker="DESCRIBE WHAT YOU WANT" onClose={onClose} onBack={onBack} footer={footer} width={760}>
      <div ref={rootRef} className="flex flex-col gap-4" data-component="prompt-wizard">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap" data-pw-reveal>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-role={`prompt-tab-${t.id}`}
              onClick={() => switchTab(t.id)}
              className="px-3 h-9 rounded-ds-sm flex items-center gap-1.5 ds-press transition-all"
              style={tab === t.id ? activeKeyStyle(DS_ACCENT) : { background: WELL_BG, boxShadow: WELL_SHADOW }}
            >
              <Icon name={t.icon} size={13} color={tab === t.id ? DS.brass200 : DS.textMid} glow={tab === t.id} />
              <span className="text-[11px] font-mono font-semibold" style={{ color: tab === t.id ? 'var(--ds-brass-200)' : 'var(--ds-text-mid)' }}>
                {t.label}
              </span>
            </button>
          ))}
        </div>

        {/* Prompt */}
        <div data-pw-reveal className="flex flex-col gap-1.5">
          <SectionLabel>{tab === 'code' ? 'Describe the element' : 'Describe it'}</SectionLabel>
          <textarea
            data-control="prompt-text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder={
              tab === '3d'
                ? 'e.g. a brass pocket watch, ornate, studio lit'
                : tab === 'video'
                  ? 'e.g. gentle drifting glow, slow loop'
                  : tab === 'code'
                    ? 'e.g. a glowing ice torus that slowly spins'
                    : 'e.g. a deep-space nebula in brass and ice tones'
            }
            className="ds-input w-full resize-none"
            style={{ padding: '8px 10px', lineHeight: 1.5 }}
          />
        </div>

        {/* Quality (image only, when >1 model) */}
        {tab === 'image' && tabModels.length > 1 && (
          <div data-pw-reveal>
            <ModelPicker
              models={tabModels}
              selectedId={selectedModel?.id ?? null}
              kind="image"
              onSelect={(id) => {
                const m = tabModels.find((x) => x.id === id);
                if (m?.quality) setQuality(m.quality);
              }}
            />
          </div>
        )}

        {/* Multi-view / reference slots */}
        {showSlots && (
          <div data-pw-reveal className="flex flex-col gap-1.5">
            <SectionLabel>{tab === '3d' ? 'Views' : tab === 'video' ? 'Starting picture' : 'Reference'}</SectionLabel>
            <div className="text-[8.5px] font-mono leading-tight" style={{ color: 'var(--ds-text-low)' }}>{slotHint}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {(tab === '3d' ? [0, 1, 2, 3] : [0]).map((i) => (
                <SlotWell
                  key={i}
                  index={i}
                  label={tab === '3d' ? VIEW_LABELS[i] : 'Picture'}
                  url={slots[i]}
                  uploading={uploadingSlot === i}
                  onFile={(files) => void handleSlotFile(i, files)}
                  onClear={() => clearSlot(i)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Result viewport */}
        {result && (
          <div data-pw-reveal className="flex flex-col gap-2">
            <SectionLabel>Result</SectionLabel>
            <ResultViewport result={result} />
            {modifyOpen && (
              <div className="flex items-center gap-1.5">
                <input
                  data-control="prompt-modify-text"
                  value={modifyPrompt}
                  onChange={(e) => setModifyPrompt(e.target.value)}
                  placeholder={result.images?.[0] ? 'Describe the change…' : 'Tweak the description…'}
                  className="ds-input flex-1"
                  style={{ minHeight: 32 }}
                />
                <button type="button" data-role="prompt-modify-apply" onClick={() => void runModify()} className="ds-btn ds-btn--quiet ds-press" disabled={busy || !modifyPrompt.trim()}>
                  {busy ? '…' : 'Apply'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="px-2.5 py-2 rounded-ds-sm flex items-start gap-2"
            data-control="prompt-error"
            style={{ background: dsAlpha(DS.ice400, 0.1), boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.28)}` }}
          >
            <Icon name="sparkle" size={12} color={DS.ice300} />
            <span className="text-[9.5px] font-mono leading-relaxed" style={{ color: 'var(--ds-text)' }}>{error}</span>
          </div>
        )}

        {busy && !result && (
          <div className="text-[10px] font-mono flex items-center gap-2" style={{ color: 'var(--ds-text-mid)' }} data-control="prompt-busy">
            <Icon name="sparkle" size={12} color={DS.brass200} glow />
            Generating — this can take a moment…
          </div>
        )}
      </div>
    </WizardWindow>
  );
}

function SlotWell({
  index,
  label,
  url,
  uploading,
  onFile,
  onClear,
}: {
  index: number;
  label: string;
  url: string | null;
  uploading: boolean;
  onFile: (files: FileList | File[] | null) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div
      className="relative aspect-square rounded-ds-sm flex items-center justify-center overflow-hidden"
      style={{ background: WELL_BG, boxShadow: WELL_SHADOW, border: `1px dashed ${dsAlpha(DS_ACCENT, 0.25)}` }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFile(e.dataTransfer?.files ?? null);
      }}
      data-control={`prompt-slot-${index}`}
    >
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${label}`}
            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-ds-xs flex items-center justify-center ds-press"
            style={{ background: dsAlpha(DS.void, 0.6) }}
          >
            <Icon name="close" size={9} color={DS.textMid} />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-full flex flex-col items-center justify-center gap-1"
        >
          <Icon name={uploading ? 'sparkle' : 'plus'} size={14} color={DS.textMid} glow={uploading} />
          <span className="text-[8px] font-mono" style={{ color: 'var(--ds-text-low)' }}>{uploading ? '…' : label}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function ResultViewport({ result }: { result: MediaGenResult }) {
  if (result.kind === '3d' && result.meshUrl) {
    return <Glb3DPreview url={result.meshUrl} poster={result.previewUrl} height={300} />;
  }
  if (result.kind === 'video' && result.videoUrl) {
    return (
      <video
        data-control="result-video"
        src={result.videoUrl}
        poster={result.posterUrl}
        controls
        autoPlay
        loop
        muted
        playsInline
        className="w-full rounded-ds-sm"
        style={{ maxHeight: 320, background: WELL_BG }}
      />
    );
  }
  if ((result.kind === 'image' || result.kind === 'edit') && result.images?.[0]) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        data-control="result-image"
        src={result.images[0].url}
        alt="Generated result"
        className="w-full rounded-ds-sm object-contain"
        style={{ maxHeight: 320, background: WELL_BG }}
      />
    );
  }
  if (result.kind === 'code' && result.compose) {
    return (
      <div className="px-3 py-3 rounded-ds-sm flex items-center gap-2.5" style={{ background: WELL_BG, boxShadow: WELL_SHADOW }} data-control="result-code">
        <Icon name="cube" size={20} color={DS.brass200} glow />
        <div className="flex flex-col">
          <span className="text-[11px] font-mono" style={{ color: 'var(--ds-text)' }}>{result.summary ?? 'A composed 3D element.'}</span>
          <span className="text-[8.5px] font-mono" style={{ color: 'var(--ds-text-low)' }}>Use this to place it on the element — then transform, light, and animate it.</span>
        </div>
      </div>
    );
  }
  return null;
}
