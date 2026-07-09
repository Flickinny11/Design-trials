// W-BG — the 60-entry background catalog: registry integrity, catalog axes,
// grammar grounding, deterministic id-stable builds, asset honesty (every
// referenced plate exists on disk), the W-2D render-mode gate, search, and
// the shared render-core + runtime mounter (no-GPU construction).

import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { Scene, PerspectiveCamera } from "three";
import {
  BACKGROUND_PRESETS,
  applyBackgroundPreset,
} from "@/lib/editor/backgrounds/presets";
import {
  BACKGROUND_CATEGORY_IDS,
  BACKGROUND_MOTION_TAGS,
  type BackgroundCategoryId,
} from "@/lib/editor/backgrounds/types";
import {
  catalogForRenderMode,
  groupByCategory,
  searchCatalog,
  presetFitsRenderMode,
  hubRenderModeOf,
} from "@/lib/editor/backgrounds/catalog";
import { BACKGROUND_PALETTES } from "@/lib/editor/backgrounds/palettes";
import { BACKGROUND_LAYER_KIND_VALUES } from "@/lib/prism-graph/types";
import {
  createGradientVolumeMaterial,
  createGradientVolumeUniforms,
} from "@/lib/editor/backgrounds/render-core/gradient-volume-material";
import { mountProceduralBackground } from "@/lib/prism/runtime/shared/procedural-background";

const ROOT = process.cwd();
const ATTACHMENTS = new Set([
  "viewport-fixed",
  "camera-locked",
  "parallax",
  "world",
  "infinite-environment",
]);

function corpusFamilyIds(): Set<string> {
  const dir = path.join(ROOT, "design-grammar", "families");
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, "")),
  );
}

describe("W-BG catalog registry", () => {
  it("holds 50-60 entries with globally unique ids (mission size)", () => {
    expect(BACKGROUND_PRESETS.length).toBeGreaterThanOrEqual(50);
    expect(BACKGROUND_PRESETS.length).toBeLessThanOrEqual(60);
    const ids = BACKGROUND_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry carries valid catalog axes (category/motion/renderModes/tier/palette/keywords)", () => {
    for (const p of BACKGROUND_PRESETS) {
      expect(BACKGROUND_CATEGORY_IDS, p.id).toContain(p.category);
      expect(BACKGROUND_MOTION_TAGS, p.id).toContain(p.motion);
      expect(p.renderModes.length, p.id).toBeGreaterThan(0);
      for (const m of p.renderModes) expect(["2d", "3d"], p.id).toContain(m);
      expect(["T0", "T1", "T2"], p.id).toContain(p.perfTier);
      expect(p.keywords.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.tagline.length, p.id).toBeGreaterThan(0);
      const paletteId = String(p.defaultParams.palette ?? "");
      expect(
        BACKGROUND_PALETTES[paletteId],
        `${p.id} palette ${paletteId}`,
      ).toBeDefined();
    }
  });

  it("every entry cites a REAL design-grammar family (grounded originals)", () => {
    const families = corpusFamilyIds();
    for (const p of BACKGROUND_PRESETS) {
      expect(
        families.has(p.grammarFamily),
        `${p.id} -> ${p.grammarFamily}`,
      ).toBe(true);
    }
  });

  it("spans distinct families: every category is populated + >=6 grammar families cited", () => {
    const byCat = groupByCategory(BACKGROUND_PRESETS);
    expect(byCat.map((g) => g.category)).toEqual([...BACKGROUND_CATEGORY_IDS]);
    const familiesUsed = new Set(
      BACKGROUND_PRESETS.map((p) => p.grammarFamily),
    );
    expect(familiesUsed.size).toBeGreaterThanOrEqual(6);
  });

  it("build() is deterministic + id-stable, with valid kinds/attachments", () => {
    for (const p of BACKGROUND_PRESETS) {
      const a = p.build(p.defaultParams);
      const b = p.build(p.defaultParams);
      expect(a, p.id).toEqual(b);
      expect(a.length, p.id).toBeGreaterThan(0);
      for (const layer of a) {
        expect(layer.id.startsWith(p.id), `${p.id} layer ${layer.id}`).toBe(
          true,
        );
        expect(layer.presetId, layer.id).toBe(p.id);
        if (layer.kind)
          expect(BACKGROUND_LAYER_KIND_VALUES, layer.id).toContain(layer.kind);
        expect(ATTACHMENTS.has(layer.attachment), layer.id).toBe(true);
      }
    }
  });

  it("re-apply with new params updates in place (same layer ids)", () => {
    for (const p of BACKGROUND_PRESETS) {
      const a = applyBackgroundPreset(p.id, p.defaultParams).map((l) => l.id);
      const b = applyBackgroundPreset(p.id, {
        ...p.defaultParams,
        density: 0.9,
      }).map((l) => l.id);
      expect(a, p.id).toEqual(b);
    }
  });

  it("asset honesty: every referenced sourceUrl/depthMapUrl exists under public/", () => {
    for (const p of BACKGROUND_PRESETS) {
      for (const layer of p.build(p.defaultParams)) {
        for (const url of [layer.sourceUrl, layer.depthMapUrl]) {
          if (!url) continue;
          const file = path.join(ROOT, "public", url.replace(/^\//, ""));
          expect(existsSync(file), `${p.id}: missing ${url}`).toBe(true);
        }
      }
    }
  });
});

describe("W-BG catalog W-2D gate + search", () => {
  it("a flat hub is offered ONLY affirmatively-2d entries; a 3d hub sees all", () => {
    const flat = catalogForRenderMode("2d");
    expect(flat.length).toBeGreaterThanOrEqual(20);
    expect(flat.length).toBeLessThan(BACKGROUND_PRESETS.length);
    for (const p of flat) expect(p.renderModes).toContain("2d");
    expect(catalogForRenderMode("3d").length).toBe(BACKGROUND_PRESETS.length);
  });

  it("depth-led categories are never 2d-tagged; minimal is 2d-first", () => {
    for (const p of BACKGROUND_PRESETS) {
      if (p.category === "deep-space" || p.category === "captured") {
        expect(p.renderModes, p.id).not.toContain("2d");
      }
      if (p.category === "minimal") {
        expect(p.renderModes, p.id).toContain("2d");
        expect(p.perfTier, p.id).toBe("T0");
      }
    }
  });

  it("hubRenderModeOf defaults absent to 3d (W-2D honesty law)", () => {
    expect(hubRenderModeOf({ renderMode: "2d" })).toBe("2d");
    expect(hubRenderModeOf({})).toBe("3d");
    expect(hubRenderModeOf(null)).toBe("3d");
    const p3d = BACKGROUND_PRESETS.find((p) => !p.renderModes.includes("2d"))!;
    expect(presetFitsRenderMode(p3d, "2d")).toBe(false);
    expect(presetFitsRenderMode(p3d, "3d")).toBe(true);
  });

  it("search matches names, keywords, moods, palettes; tokens AND together", () => {
    const silk = searchCatalog("silk");
    expect(silk.map((p) => p.id)).toContain("chrome-silk");
    expect(silk.map((p) => p.id)).toContain("glacier-silk");
    const iceSilk = searchCatalog("silk ice");
    expect(iceSilk.map((p) => p.id)).toContain("glacier-silk");
    expect(iceSilk.map((p) => p.id)).not.toContain("chrome-silk");
    expect(searchCatalog("").length).toBe(BACKGROUND_PRESETS.length);
    expect(searchCatalog("zzz-no-such-thing").length).toBe(0);
    // Category label vocabulary reaches entries via the category axis.
    expect(searchCatalog("minimal").length).toBeGreaterThanOrEqual(8);
  });

  it("groupByCategory groups in canonical order and drops empty groups", () => {
    const groups = groupByCategory(searchCatalog("aurora"));
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.entries.length).toBeGreaterThan(0);
    const order = groups.map((g) => g.category);
    const canonical = [...BACKGROUND_CATEGORY_IDS].filter((c) =>
      order.includes(c as BackgroundCategoryId),
    );
    expect(order).toEqual(canonical);
  });
});

describe("W-BG render-core + runtime mounter (no-GPU construction)", () => {
  it("render-core builds a node material with color wiring", () => {
    const uniforms = createGradientVolumeUniforms();
    const mat = createGradientVolumeMaterial({
      palette: BACKGROUND_PALETTES.arc,
      variant: "aurora",
      octaves: 3,
      overBackdrop: false,
      uniforms,
    });
    expect((mat as unknown as { colorNode: unknown }).colorNode).toBeTruthy();
    expect(mat.transparent).toBe(false);
    mat.dispose();
  });

  it("mountProceduralBackground mounts every generated kind into a bare Scene and disposes clean", () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 16 / 9, 0.1, 2000);
    camera.position.set(0, 0, 12);
    // A representative generated stack: env shell + particles + fluid (the
    // plate kinds load textures async; mounted with visible=false in node).
    const layers = [
      ...applyBackgroundPreset("quiet-starlight"),
      ...applyBackgroundPreset("chrome-silk").map((l) => ({
        ...l,
        id: `x-${l.id}`,
      })),
    ];
    const before = scene.children.length;
    const handle = mountProceduralBackground(scene, camera, layers);
    expect(handle.layerCount).toBe(layers.length);
    expect(scene.children.length).toBe(before + layers.length);
    expect(handle.kinds).toContain("gradient-volume");
    expect(handle.kinds).toContain("particle-field");
    expect(handle.kinds).toContain("fluid-overlay");
    // Ticking advances without a renderer (uniforms only).
    handle.tick(0.016);
    handle.tick(0.016);
    handle.dispose();
    expect(scene.children.length).toBe(before);
  });

  it("splat layers stay editor-only in the runtime mounter (documented drop)", () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const layers = applyBackgroundPreset("captured-observatory");
    const handle = mountProceduralBackground(scene, camera, layers);
    expect(handle.kinds).not.toContain("splat");
    handle.dispose();
  });
});
