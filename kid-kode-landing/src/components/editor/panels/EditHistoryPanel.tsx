"use client";

// EDITOR-EXP P7 (C33) — Edit History timeline.
//
// Mounted in the Inspector "History" tab. Renders the real zundo temporal
// timeline of the source graph: an ordered list of past states (each with a
// human-readable description + timestamp), a "you are here" marker, and the
// redo-able future states. Clicking any entry JUMPS the graph to that state
// through the coherent wrappers (history-coherence.ts), so the schema reverts,
// the BUILT scene re-realizes (rebuild-version bump), the server autosave
// re-fires, and any pending preview overlay is reconciled (C32 + C34).
//
// Premium per the design law: the panel body is a slab-hosted glass surface
// (useChromeSlab material:'glass'); ds-* fallback classes are retained for
// t0/t1 (INV-9). No flat fills, no backdrop-filter, no purple — Observatory
// Brass tokens only.

import { useEffect, useReducer } from "react";
import {
  getHistoryMeta,
  getTemporalStore,
  type HistoryEntryMeta,
} from "@/stores/useGraphSourceStore";
import { useGraphSourceStore } from "@/stores/useGraphSourceStore";
import {
  coherentJumpBy,
  coherentUndo,
  coherentRedo,
  getFutureMeta,
  canUndo,
  canRedo,
} from "@/lib/editor/history-coherence";
import { useChromeSlab } from "@/components/editor/chrome-layer";
import { Icon } from "@/components/editor/icons/Icon";
import { DS, dsAlpha } from "@/components/editor/design-system";

function formatStamp(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

// Verb → glyph mapping so the timeline reads at a glance. Falls back to the
// generic edit pencil.
function iconForDescription(desc: string): string {
  const d = desc.toLowerCase();
  if (d.startsWith("add") || d.startsWith("place")) return "plus";
  if (d.startsWith("delete") || d.startsWith("remove")) return "trash";
  if (d.startsWith("move")) return "move";
  if (d.startsWith("clone")) return "group";
  if (d.startsWith("group")) return "group";
  if (d.startsWith("ungroup")) return "ungroup";
  if (d.startsWith("lock")) return "lock";
  if (d.startsWith("connect") || d.startsWith("remove connection"))
    return "link";
  if (d.startsWith("recolor") || d.startsWith("restyle")) return "palette";
  if (d.startsWith("reanimate")) return "play";
  return "edit";
}

export default function EditHistoryPanel() {
  // Slab-hosted glass body (design law). Hook before any early return.
  const bodySlab = useChromeSlab({ material: "glass", radius: 13, frost: 0.5 });

  // The temporal store and the source store both drive this view; re-render on
  // either. zundo's temporal store is a plain zustand store, so we subscribe to
  // it directly; the source store subscription catches the metadata-log changes
  // the coherent wrappers make (which the temporal store alone wouldn't signal).
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const temporal = getTemporalStore();
    const unsubTemporal = temporal.subscribe(() => force());
    const unsubSource = useGraphSourceStore.subscribe(() => force());
    return () => {
      unsubTemporal();
      unsubSource();
    };
  }, []);

  const pastMeta = getHistoryMeta();
  const futureMeta = getFutureMeta();
  const hasAny = pastMeta.length > 0 || futureMeta.length > 0;

  // Past entries: oldest first. Each row is an APPLIED edit (Photoshop-style
  // history). The NEWEST applied edit (i === length-1) is "current" — clicking
  // it is a no-op (0 steps). Clicking an earlier applied edit undoes back to
  // just AFTER it, i.e. undo (length-1 - i) steps.
  const pastEntries = pastMeta.map((m, i) => ({
    meta: m,
    steps: -(pastMeta.length - 1 - i),
    key: `past-${i}`,
  }));

  // Future (undone) entries in chronological order — the next redo target is
  // the FIRST row. Clicking the j-th future row redoes (j + 1) steps.
  const futureEntries = futureMeta.map((m, j) => ({
    meta: m,
    steps: j + 1,
    key: `future-${j}`,
  }));

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="ds-kicker">EDIT HISTORY</div>
        <div className="flex items-center gap-1.5">
          <HistoryNavButton
            label="Undo"
            icon="refresh"
            disabled={!canUndo()}
            onClick={() => coherentUndo()}
            flip
          />
          <HistoryNavButton
            label="Redo"
            icon="refresh"
            disabled={!canRedo()}
            onClick={() => coherentRedo()}
          />
        </div>
      </div>

      {/* Slab-hosted glass timeline body. */}
      <div
        ref={bodySlab.ref}
        data-role="history-timeline"
        className="ds-glass ds-edge rounded-ds-md p-2.5 space-y-1 max-h-[360px] overflow-y-auto"
        style={{ position: "relative" }}
      >
        {!hasAny ? (
          <div className="ds-body px-3 py-2.5 text-[12px] text-ds-text-mid italic">
            No edits yet. Changes you make appear here — press Cmd+Z to undo.
          </div>
        ) : (
          <>
            {pastEntries.map((e, i) => (
              <HistoryRow
                key={e.key}
                meta={e.meta}
                tense="past"
                current={i === pastEntries.length - 1}
                onJump={() => coherentJumpBy(e.steps)}
              />
            ))}
            {/* "You are here" marker sits between past and future when both
                exist; when only past exists the last past row is the head. */}
            {futureEntries.length > 0 && (
              <div
                data-role="history-head"
                className="flex items-center gap-2 px-2 py-1 select-none"
              >
                <span
                  className="h-px flex-1"
                  style={{ background: dsAlpha(DS.metal400, 0.4) }}
                />
                <span
                  className="ds-kicker"
                  style={{ color: "var(--ds-metal-300)", fontSize: 9 }}
                >
                  CURRENT
                </span>
                <span
                  className="h-px flex-1"
                  style={{ background: dsAlpha(DS.metal400, 0.4) }}
                />
              </div>
            )}
            {futureEntries.map((e) => (
              <HistoryRow
                key={e.key}
                meta={e.meta}
                tense="future"
                current={false}
                onJump={() => coherentJumpBy(e.steps)}
              />
            ))}
          </>
        )}
      </div>

      <div className="ds-body text-[11px] text-ds-text-low pt-0.5">
        {pastMeta.length} change{pastMeta.length === 1 ? "" : "s"} tracked
        {futureMeta.length > 0 ? ` · ${futureMeta.length} redo-able` : ""}. Up
        to 100 steps. Cmd+Z undo · Cmd+Shift+Z redo.
      </div>
    </div>
  );
}

function HistoryRow({
  meta,
  tense,
  current,
  onJump,
}: {
  meta: HistoryEntryMeta;
  tense: "past" | "future";
  current: boolean;
  onJump: () => void;
}) {
  const isFuture = tense === "future";
  return (
    <button
      type="button"
      onClick={onJump}
      data-role="history-entry"
      data-tense={tense}
      data-current={current ? "true" : undefined}
      className={`ds-press w-full flex items-center gap-2.5 px-3 py-2 rounded-ds-sm text-left transition-colors ${
        current
          ? "bg-white/5"
          : isFuture
            ? "opacity-55 hover:opacity-90 hover:bg-white/5"
            : "hover:bg-white/5"
      }`}
    >
      <span
        className="ds-chip flex items-center justify-center shrink-0"
        style={{
          width: 22,
          height: 22,
          borderRadius: "var(--ds-r-sm)",
        }}
      >
        <Icon
          name={iconForDescription(meta.description)}
          size={12}
          color={current ? DS.metal300 : isFuture ? DS.ice500 : DS.ice300}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[12px] font-ui font-medium truncate"
          style={{ color: current ? "var(--ds-metal-200)" : "var(--ds-text)" }}
        >
          {meta.description}
        </span>
        <span className="block text-[10px] font-mono text-ds-text-low tabular-nums">
          {formatStamp(meta.timestamp)}
          {current ? " · current" : isFuture ? " · redo" : ""}
        </span>
      </span>
    </button>
  );
}

function HistoryNavButton({
  label,
  icon,
  disabled,
  onClick,
  flip,
}: {
  label: string;
  icon: string;
  disabled: boolean;
  onClick: () => void;
  flip?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`ds-press ds-smoked ds-edge flex items-center justify-center rounded-ds-sm transition-opacity ${
        disabled ? "opacity-30 pointer-events-none" : "hover:bg-white/5"
      }`}
      style={{ width: 28, height: 28 }}
    >
      <span style={flip ? { transform: "scaleX(-1)" } : undefined}>
        <Icon name={icon} size={13} color={DS.ice300} />
      </span>
    </button>
  );
}
