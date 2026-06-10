'use client';

// EB-03-05 — Galaxy mode global filter overlay (SC-016).
//
// Renders a small toggle pill + filter input that lives only in galaxy mode.
// The text the user types is mirrored into the editor store as `filterQuery`;
// `GraphScene` reads that value, calls `computeGalaxyFilterMatches`, and dims
// non-matching hubs/nodes. Clearing the filter restores full brightness.

import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { Icon } from '@/components/editor/icons/Icon';

export default function GalaxyFilterOverlay() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const filterOpen = useGraphEditorStore((s) => s.filterOpen);
  const filterQuery = useGraphEditorStore((s) => s.filterQuery);
  const toggleFilter = useGraphEditorStore((s) => s.toggleFilter);
  const setFilterQuery = useGraphEditorStore((s) => s.setFilterQuery);
  const clearFilter = useGraphEditorStore((s) => s.clearFilter);

  if (viewMode !== 'galaxy') return null;

  const active = filterQuery.trim().length > 0;

  return (
    <div
      data-component="galaxy-filter-overlay"
      className="absolute top-12 right-3 z-40 pointer-events-auto flex flex-col items-end gap-2"
    >
      <button
        type="button"
        onClick={toggleFilter}
        title={filterOpen ? 'Close filter' : 'Open filter'}
        className={`flex items-center gap-2 h-8 px-3 rounded-full border transition-colors ${
          filterOpen || active
            ? 'border-[#5d8bff]/60 bg-[#5d8bff]/15 text-white'
            : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10'
        }`}
      >
        <Icon name="search" size={11} color={filterOpen || active ? '#bcd4ff' : '#b5bddf'} />
        <span className="text-[10px] font-mono tracking-widest uppercase">
          Filter{active ? ` · ${filterQuery.trim().slice(0, 18)}` : ''}
        </span>
      </button>

      {filterOpen && (
        <div
          className="w-[280px] rounded-xl border border-white/10 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(20,22,44,0.96), rgba(12,13,34,0.96))',
            backdropFilter: 'blur(28px) saturate(160%)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
            <Icon name="search" size={12} color="#b5bddf" />
            <input
              data-component="galaxy-filter-input"
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter hubs, nodes…"
              className="flex-1 bg-transparent outline-none text-white text-[12px] font-sans placeholder:text-white/30"
              autoFocus
            />
            {active && (
              <button
                type="button"
                onClick={clearFilter}
                title="Clear filter"
                className="text-[10px] font-mono text-white/55 hover:text-white px-1.5 py-0.5 rounded border border-white/10"
              >
                Clear
              </button>
            )}
          </div>
          <div className="px-3 py-2 text-[10px] font-mono text-white/45 leading-relaxed">
            {active
              ? 'Non-matching hubs and nodes are dimmed. Matching items remain interactive.'
              : 'Type to dim non-matching hubs and nodes by name, route, element type, or caption.'}
          </div>
        </div>
      )}
    </div>
  );
}
