'use client';

// EB-03-05 — Galaxy mode global filter overlay (SC-016).
//
// Renders a small toggle pill + filter input that lives only in galaxy mode.
// The text the user types is mirrored into the editor store as `filterQuery`;
// `GraphScene` reads that value, calls `computeGalaxyFilterMatches`, and dims
// non-matching hubs/nodes. Clearing the filter restores full brightness.
//
// Chrome: Observatory Brass — machined toggle chip (ds-btn, brass when armed)
// over a smoked-glass dock (ds-smoked ds-edge) with a carved ds-input trough.

import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { Icon } from '@/components/editor/icons/Icon';
import { DS } from '@/components/editor/design-system';

export default function GalaxyFilterOverlay() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const filterOpen = useGraphEditorStore((s) => s.filterOpen);
  const filterQuery = useGraphEditorStore((s) => s.filterQuery);
  const toggleFilter = useGraphEditorStore((s) => s.toggleFilter);
  const setFilterQuery = useGraphEditorStore((s) => s.setFilterQuery);
  const clearFilter = useGraphEditorStore((s) => s.clearFilter);
  // Wave-3 advocate MUST-FIX: the dock shares the top-right corner with the
  // floating Inspector (md:right-3 w-[460px]) and was painting over its
  // header buttons. When an inspector panel is visible, slide the dock left
  // of the panel (position-only; all behavior unchanged).
  const inspectorVisible = useGraphEditorStore(
    (s) => s.inspectorOpen && (s.selectedNodeId !== null || s.selectedHubId !== null)
  );

  if (viewMode !== 'galaxy') return null;

  const active = filterQuery.trim().length > 0;
  const armed = filterOpen || active;

  return (
    <div
      data-component="galaxy-filter-overlay"
      className={`absolute top-16 z-40 pointer-events-auto flex flex-col items-end gap-2 right-3 ${
        inspectorVisible ? 'md:right-[484px]' : ''
      }`}
    >
      <button
        type="button"
        onClick={toggleFilter}
        title={filterOpen ? 'Close filter' : 'Open filter'}
        className={`ds-btn ds-press rounded-full h-8 ${armed ? 'ds-btn--ghost' : ''}`}
        style={
          armed
            ? {
                borderRadius: 'var(--ds-r-pill)',
                boxShadow: 'inset 0 0 0 1px rgba(var(--ds-brass-400-rgb), 0.34), var(--ds-elev-1), var(--ds-glow-brass)',
              }
            : { borderRadius: 'var(--ds-r-pill)' }
        }
      >
        <Icon name="search" size={11} color={armed ? DS.brass300 : DS.textMid} glow={armed} />
        <span className="text-[10px] font-mono tracking-widest uppercase">
          Filter{active ? ` · ${filterQuery.trim().slice(0, 18)}` : ''}
        </span>
      </button>

      {filterOpen && (
        <div className="w-[280px] ds-smoked ds-edge rounded-ds-md overflow-hidden ds-reveal">
          <div
            className="flex items-center gap-2 px-2.5 py-2"
            style={{ boxShadow: 'inset 0 -1px 0 var(--ds-edge-shade), inset 0 1px 0 var(--ds-edge-side)' }}
          >
            <Icon name="search" size={12} color={DS.brass300} />
            <input
              data-component="galaxy-filter-input"
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter hubs, nodes…"
              className="ds-input flex-1 min-w-0 font-sans"
              autoFocus
            />
            {active && (
              <button
                type="button"
                onClick={clearFilter}
                title="Clear filter"
                className="ds-btn ds-btn--quiet ds-press shrink-0 text-[10px]"
              >
                Clear
              </button>
            )}
          </div>
          <div className="px-3 py-2 text-[10px] font-mono text-ds-text-mid leading-relaxed">
            {active
              ? 'Non-matching hubs and nodes are dimmed. Matching items remain interactive.'
              : 'Type to dim non-matching hubs and nodes by name, route, element type, or caption.'}
          </div>
        </div>
      )}
    </div>
  );
}
