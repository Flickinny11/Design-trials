'use client';

// W-TPL D5 — the template picker. Two flows, one overlay:
//
//  • mode 'hub'     — "New hub from template". Categorized (by archetype) +
//    searchable grid of the 16 hub templates. Pick one → name your hub →
//    instantiateHubTemplate remaps every id → addHub + addNodesBatch land it in
//    the LIVE graph → drillIntoHub flies the camera to the new planet (galaxy →
//    canvas), where it is canvas-editable per normal runtime law. A live
//    Preview opens the template's real /templates/<slug> runtime in a new tab.
//
//  • mode 'section' — "Add a section". Searchable grid of the 10 droppable
//    section templates. Pick one → it builds fresh seq-suffixed nodes anchored
//    BELOW the active hub's existing content → addNodesBatch lands them.
//
// Every instantiation / drop fires a fail-open catalog_event beacon (D6). The
// overlay is ADDITIVE editor chrome: it owns nothing but its own open state
// (useTemplatePickerStore) and writes only through the certified store actions.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DS, dsAlpha } from '@/components/editor/design-system';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useTemplatePickerStore } from '@/stores/useTemplatePickerStore';
import {
  HUB_TEMPLATE_CATALOG,
  SECTION_TEMPLATE_CATALOG,
  searchHubTemplates,
  searchSectionTemplates,
} from '@/lib/templates/catalog-registry';
import {
  ARCHETYPE_LABELS,
  TEMPLATE_ARCHETYPES,
  type HubTemplateEntry,
  type SectionTemplateEntry,
  type TemplateArchetype,
} from '@/lib/templates/catalog-types';
import { freshTemplateSeq, instantiateHubTemplate } from '@/lib/templates/instantiate';
import { beaconCatalogEvent } from '@/lib/templates/catalog-beacon';

export default function NewHubPicker() {
  const open = useTemplatePickerStore((s) => s.open);
  const mode = useTemplatePickerStore((s) => s.mode);
  const close = useTemplatePickerStore((s) => s.close);

  const addHub = useGraphSourceStore((s) => s.addHub);
  const addNodesBatch = useGraphSourceStore((s) => s.addNodesBatch);
  const addEdge = useGraphSourceStore((s) => s.addEdge);
  const nodes = useGraphSourceStore((s) => s.nodes);
  const hubs = useGraphSourceStore((s) => s.hubs);

  const drillIntoHub = useGraphEditorStore((s) => s.drillIntoHub);
  const selectNode = useGraphEditorStore((s) => s.selectNode);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);

  const [query, setQuery] = useState('');
  const [archetype, setArchetype] = useState<TemplateArchetype | 'all'>('all');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [hubName, setHubName] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset transient state whenever the picker (re)opens or switches mode.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setArchetype('all');
    setSelectedSlug(null);
    setHubName('');
    const t = setTimeout(() => searchRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [open, mode]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  const hubResults = useMemo<HubTemplateEntry[]>(() => {
    if (mode !== 'hub') return [];
    const pool = searchHubTemplates(query, archetype === 'all' ? undefined : archetype);
    return pool;
  }, [mode, query, archetype]);

  const sectionResults = useMemo<SectionTemplateEntry[]>(() => {
    if (mode !== 'section') return [];
    return searchSectionTemplates(query);
  }, [mode, query]);

  const selectedHub = useMemo(
    () => HUB_TEMPLATE_CATALOG.find((t) => t.slug === selectedSlug) ?? null,
    [selectedSlug],
  );
  const selectedSection = useMemo(
    () => SECTION_TEMPLATE_CATALOG.find((s) => s.slug === selectedSlug) ?? null,
    [selectedSlug],
  );

  const targetHub = useMemo(
    () => hubs.find((h) => h.hubId === activeHubId) ?? hubs[0] ?? null,
    [hubs, activeHubId],
  );

  // ── Create a hub from the selected template ───────────────────────────────
  const createHub = useCallback(() => {
    if (!selectedHub) return;
    const inst = instantiateHubTemplate(selectedHub, {
      name: hubName.trim() || undefined,
    });
    inst.hubs.forEach((h) => addHub(h));
    addNodesBatch(inst.nodes);
    inst.edges.forEach((e) => addEdge(e));
    beaconCatalogEvent({
      stage: 'instantiate-hub',
      template_slug: selectedHub.slug,
      archetype: selectedHub.archetype,
      primary_family: selectedHub.primaryFamily,
      route: selectedHub.route.hero,
      node_count: inst.nodes.length,
      hub_ref: inst.primaryHubId,
      detail: hubName.trim() ? `named "${hubName.trim()}"` : undefined,
    });
    close();
    // Fly to the new planet (galaxy → canvas) after the store settles.
    setTimeout(() => drillIntoHub(inst.primaryHubId), 30);
  }, [selectedHub, hubName, addHub, addNodesBatch, addEdge, drillIntoHub, close]);

  // ── Drop the selected section into the active hub ─────────────────────────
  const dropSection = useCallback(() => {
    if (!selectedSection || !targetHub) return;
    const hubId = targetHub.hubId;
    // Anchor the section BELOW the hub's lowest existing content so it stacks
    // rather than overlapping. Empty hub → drop at the origin.
    const hubNodes = nodes.filter((n) => n.parentHubId === hubId);
    let lowestY = 0;
    for (const n of hubNodes) {
      const y = n.scenePosition?.y ?? n.visual?.transform?.y ?? 0;
      const h = n.visual?.transform?.height ?? 0;
      lowestY = Math.min(lowestY, y - h / 2);
    }
    const anchorY = hubNodes.length > 0 ? lowestY - selectedSection.height / 2 - 0.6 : 0;
    const built = selectedSection.build({
      hubId,
      x: 0,
      y: anchorY,
      z: 0,
      seq: freshTemplateSeq(),
    });
    const ids = addNodesBatch(built);
    beaconCatalogEvent({
      stage: 'drop-section',
      section_slug: selectedSection.slug,
      section_kind: selectedSection.kind,
      node_count: built.length,
      hub_ref: hubId,
    });
    close();
    if (ids.length > 0) setTimeout(() => selectNode(ids[0]), 30);
  }, [selectedSection, targetHub, nodes, addNodesBatch, selectNode, close]);

  if (!open) return null;

  const isHub = mode === 'hub';

  return (
    <div
      data-template-picker
      data-picker-mode={mode}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8"
    >
      {/* Smoked scrim — click to dismiss. */}
      <button
        type="button"
        aria-label="Close template picker"
        onClick={close}
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(4,6,10,0.72)', backdropFilter: 'blur(6px)' }}
      />

      {/* Glass panel. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isHub ? 'New hub from template' : 'Add a section'}
        className="ds-glass ds-edge relative flex w-full max-w-5xl flex-col overflow-hidden"
        style={{
          maxHeight: '86vh',
          borderRadius: 'var(--ds-r-lg, 18px)',
          boxShadow: 'var(--ds-chamfer-soft), 0 40px 120px -30px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-white/8">
          <div className="min-w-0">
            <h2 className="font-ui text-[17px] font-semibold text-ds-text tracking-tight">
              {isHub ? 'New hub from template' : 'Add a section'}
            </h2>
            <p className="font-ui text-[12px] text-ds-text-mid mt-0.5">
              {isHub
                ? 'Drop a complete, animated page into your galaxy as a new planet — then make it yours.'
                : targetHub
                  ? `Drop a ready-made section into “${targetHub.title}”.`
                  : 'Create a hub first, then drop sections into it.'}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="ds-press shrink-0 grid place-items-center w-8 h-8 rounded-full text-ds-text-mid hover:text-ds-text hover:bg-white/8 transition-colors"
          >
            <span className="text-[18px] leading-none">×</span>
          </button>
        </div>

        {/* Search + (hub) archetype rail */}
        <div className="px-6 pt-4 pb-3 space-y-3">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isHub ? 'Search templates, families, moods…' : 'Search sections…'}
            data-picker-search
            className="ds-input w-full font-ui text-[13px] px-3 py-2 rounded-lg"
          />
          {isHub && (
            <div className="flex flex-wrap gap-1.5" data-archetype-rail>
              {(['all', ...TEMPLATE_ARCHETYPES] as const).map((a) => {
                const active = archetype === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setArchetype(a)}
                    data-archetype-chip={a}
                    className={`ds-press font-ui text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                      active
                        ? 'text-ds-metal-200 border-transparent'
                        : 'text-ds-text-mid border-white/10 hover:text-ds-text hover:border-white/20'
                    }`}
                    style={
                      active
                        ? {
                            background: 'var(--ds-grad-metal-soft)',
                            boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.arc, 0.5)}`,
                          }
                        : undefined
                    }
                  >
                    {a === 'all' ? 'All' : ARCHETYPE_LABELS[a]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {isHub ? (
            <HubGrid
              results={hubResults}
              selectedSlug={selectedSlug}
              onSelect={setSelectedSlug}
            />
          ) : (
            <SectionGrid
              results={sectionResults}
              selectedSlug={selectedSlug}
              onSelect={setSelectedSlug}
            />
          )}
          {((isHub && hubResults.length === 0) || (!isHub && sectionResults.length === 0)) && (
            <p className="font-ui text-[13px] text-ds-text-mid text-center py-10">
              Nothing matches “{query}”.
            </p>
          )}
        </div>

        {/* Footer — name-your-hub / drop action */}
        <div className="px-6 py-4 border-t border-white/8 flex items-center gap-3">
          {isHub ? (
            <>
              <input
                value={hubName}
                onChange={(e) => setHubName(e.target.value)}
                placeholder={selectedHub ? `Name your hub (default: ${selectedHub.name})` : 'Pick a template first'}
                disabled={!selectedHub}
                data-hub-name
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && selectedHub) createHub();
                }}
                className="ds-input flex-1 font-ui text-[13px] px-3 py-2 rounded-lg disabled:opacity-40"
              />
              {selectedHub && (
                <a
                  href={`/templates/${selectedHub.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  data-template-preview-link
                  className="ds-press font-ui text-[12px] font-medium px-3 py-2 rounded-lg text-ds-text-mid hover:text-ds-text border border-white/10 hover:border-white/20 transition-colors whitespace-nowrap"
                >
                  Preview ↗
                </a>
              )}
              <button
                type="button"
                onClick={createHub}
                disabled={!selectedHub}
                data-create-hub
                className="ds-press font-ui text-[13px] font-semibold px-4 py-2 rounded-lg text-ds-void disabled:opacity-40 whitespace-nowrap"
                style={{ background: 'var(--ds-grad-brass, linear-gradient(180deg,#e8c583,#b08d3f))', boxShadow: 'var(--ds-chamfer-soft)' }}
              >
                Create hub →
              </button>
            </>
          ) : (
            <>
              <div className="flex-1 font-ui text-[12px] text-ds-text-mid truncate">
                {selectedSection
                  ? targetHub
                    ? `“${selectedSection.name}” → “${targetHub.title}”`
                    : 'No hub to drop into — create one first.'
                  : 'Pick a section to drop.'}
              </div>
              <button
                type="button"
                onClick={dropSection}
                disabled={!selectedSection || !targetHub}
                data-drop-section
                className="ds-press font-ui text-[13px] font-semibold px-4 py-2 rounded-lg text-ds-void disabled:opacity-40 whitespace-nowrap"
                style={{ background: 'var(--ds-grad-brass, linear-gradient(180deg,#e8c583,#b08d3f))', boxShadow: 'var(--ds-chamfer-soft)' }}
              >
                Drop section ↓
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Hub template card grid ──────────────────────────────────────────────────
function HubGrid({
  results,
  selectedSlug,
  onSelect,
}: {
  results: HubTemplateEntry[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
      {results.map((t) => {
        const active = t.slug === selectedSlug;
        return (
          <button
            key={t.slug}
            type="button"
            onClick={() => onSelect(t.slug)}
            data-template-card={t.slug}
            data-selected={active ? 'true' : undefined}
            className="ds-press group relative text-left rounded-xl overflow-hidden border transition-all"
            style={{
              borderColor: active ? dsAlpha(t.accent, 0.9) : 'rgba(255,255,255,0.09)',
              background: `linear-gradient(160deg, ${dsAlpha(t.accent, 0.16)} 0%, rgba(10,12,16,0.5) 46%, rgba(8,10,14,0.65) 100%)`,
              boxShadow: active ? `0 0 0 1px ${dsAlpha(t.accent, 0.7)}, 0 14px 40px -18px ${dsAlpha(t.accent, 0.6)}` : undefined,
            }}
          >
            {/* accent jewel bar */}
            <span
              aria-hidden
              className="block h-1 w-full"
              style={{ background: `linear-gradient(90deg, ${t.accent}, ${dsAlpha(t.accent, 0.2)})` }}
            />
            <div className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-ui text-[14px] font-semibold text-ds-text">{t.name}</span>
                <span
                  className="font-ui text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded"
                  style={{ color: t.accent, background: dsAlpha(t.accent, 0.14) }}
                >
                  {t.route.hero}
                </span>
              </div>
              <p className="font-ui text-[11.5px] text-ds-text-mid mt-1 leading-snug line-clamp-2">
                {t.tagline}
              </p>
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <span className="font-ui text-[9.5px] uppercase tracking-wide text-ds-text-mid/80 px-1.5 py-0.5 rounded bg-white/5">
                  {ARCHETYPE_LABELS[t.archetype]}
                </span>
                <span className="font-ui text-[9.5px] text-ds-text-mid/70 truncate">
                  {t.primaryFamily.replace('legacy:', '')}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Section template card grid ──────────────────────────────────────────────
function SectionGrid({
  results,
  selectedSlug,
  onSelect,
}: {
  results: SectionTemplateEntry[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
      {results.map((s) => {
        const active = s.slug === selectedSlug;
        return (
          <button
            key={s.slug}
            type="button"
            onClick={() => onSelect(s.slug)}
            data-section-card={s.slug}
            data-selected={active ? 'true' : undefined}
            className="ds-press text-left rounded-xl overflow-hidden border transition-all p-3.5"
            style={{
              borderColor: active ? dsAlpha(s.accent, 0.9) : 'rgba(255,255,255,0.09)',
              background: `linear-gradient(160deg, ${dsAlpha(s.accent, 0.14)} 0%, rgba(10,12,16,0.55) 60%)`,
              boxShadow: active ? `0 0 0 1px ${dsAlpha(s.accent, 0.7)}` : undefined,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-ui text-[13.5px] font-semibold text-ds-text">{s.name}</span>
              <span
                className="font-ui text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ color: s.accent, background: dsAlpha(s.accent, 0.14) }}
              >
                {s.kind}
              </span>
            </div>
            <p className="font-ui text-[11.5px] text-ds-text-mid mt-1 leading-snug">{s.tagline}</p>
          </button>
        );
      })}
    </div>
  );
}
