// W-BG — catalog query layer over the preset registry.
//
// Pure functions the picker (and tests) use to group, gate, and search the
// 60-entry library. No React, no DOM — importable anywhere.

import type { PrismHub } from "../../prism-graph/types";
import type {
  BackgroundPreset,
  BackgroundCategoryId,
  BackgroundRenderModeTag,
} from "./types";
import { BACKGROUND_CATEGORY_IDS } from "./types";
import { BACKGROUND_PRESETS } from "./presets";

/** Hub render mode with the W-2D default: absent = '3d'. */
export function hubRenderModeOf(
  hub: Pick<PrismHub, "renderMode"> | undefined | null,
): "2d" | "3d" {
  return hub?.renderMode === "2d" ? "2d" : "3d";
}

/** W-2D honesty gate: on a flat hub only affirmatively-'2d' entries are
 *  offered; a 3d hub sees everything. */
export function presetFitsRenderMode(
  preset: BackgroundPreset,
  mode: BackgroundRenderModeTag,
): boolean {
  if (mode === "3d") return true;
  return preset.renderModes.includes("2d");
}

export function catalogForRenderMode(
  mode: BackgroundRenderModeTag,
): BackgroundPreset[] {
  return BACKGROUND_PRESETS.filter((p) => presetFitsRenderMode(p, mode));
}

/** Group entries by category in the canonical category order. Categories with
 *  no (mode-fitting) entries are omitted. */
export function groupByCategory(
  entries: readonly BackgroundPreset[],
): { category: BackgroundCategoryId; entries: BackgroundPreset[] }[] {
  return BACKGROUND_CATEGORY_IDS.map((category) => ({
    category,
    entries: entries.filter((p) => p.category === category),
  })).filter((g) => g.entries.length > 0);
}

/** Token search across name / tagline / keywords / category / motion /
 *  palette / grammar family. Every query token must match somewhere
 *  (AND across tokens, OR across fields). Empty query matches everything. */
export function searchCatalog(
  query: string,
  entries: readonly BackgroundPreset[] = BACKGROUND_PRESETS,
): BackgroundPreset[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...entries];
  return entries.filter((p) => {
    const hay = [
      p.id,
      p.name,
      p.tagline,
      p.category,
      p.motion,
      p.grammarFamily,
      String(p.defaultParams.palette ?? ""),
      ...p.keywords,
    ]
      .join(" ")
      .toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}
