// W-BG — prompt-to-background core: brief derivation reads the hub's live
// context (prompt words > node colours > active palette > planet identity),
// family choice rotates with anti-repetition over the REAL corpus, and R1
// synthesis speaks each family's technique vocabulary.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  deriveBackgroundBrief,
  chooseBackgroundFamily,
  synthesizeR1Stack,
  synthesizePlateAccents,
  nameForGeneration,
  paletteFromColors,
  BACKGROUND_FAMILY_POOL,
  type BackgroundFamilyLite,
  type HubGenerateContext,
} from "@/lib/editor/backgrounds/generate-core";
import { BACKGROUND_LAYER_KIND_VALUES } from "@/lib/prism-graph/types";

const HUB_3D: HubGenerateContext = { hubId: "h1", renderMode: "3d" };
const HUB_2D: HubGenerateContext = { hubId: "h2", renderMode: "2d" };

/** The REAL corpus, read from disk exactly the way the route does. */
function corpusLites(): BackgroundFamilyLite[] {
  const dir = path.join(process.cwd(), "design-grammar", "families");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const doc = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as {
        id: string;
        antiRepetition?: { clusterId?: string };
        capabilities?: { renderModes?: ("2d" | "3d")[] };
      };
      return {
        id: doc.id,
        clusterId: doc.antiRepetition?.clusterId ?? doc.id,
        renderModes: doc.capabilities?.renderModes ?? (["3d"] as const),
      };
    });
}

describe("W-BG brief derivation (context-aware)", () => {
  it("prompt colour words win the palette", () => {
    expect(deriveBackgroundBrief("a warm ember dusk", HUB_3D).palette).toBe(
      "ember",
    );
    expect(
      deriveBackgroundBrief("electric neon signal field", HUB_3D).palette,
    ).toBe("arc");
  });

  it("falls back to the hub elements’ material colours (hue vote)", () => {
    const hub: HubGenerateContext = {
      ...HUB_3D,
      nodes: [
        { caption: "Card", subtype: "panel", baseColor: "#2f8f4e" },
        { caption: "Card 2", subtype: "panel", baseColor: "#37a05a" },
      ],
    };
    expect(deriveBackgroundBrief("something for this page", hub).palette).toBe(
      "verdant",
    );
    expect(paletteFromColors(["#1ec8ff"])).toBe("arc");
    expect(paletteFromColors(["#101114"])).toBe("noir");
  });

  it("falls back to the active background palette, then the planet identity", () => {
    expect(
      deriveBackgroundBrief("something nice", {
        ...HUB_3D,
        activePalette: "garnet",
      }).palette,
    ).toBe("garnet");
    expect(
      deriveBackgroundBrief("something nice", {
        ...HUB_3D,
        identity: "ember-forge",
      }).palette,
    ).toBe("ember");
  });

  it("reads motion + photo intent; a flat hub defaults quieter (W-2D)", () => {
    expect(deriveBackgroundBrief("slow gentle mist", HUB_3D).motion).toBe(
      "calm",
    );
    expect(deriveBackgroundBrief("fast electric storm", HUB_3D).motion).toBe(
      "energetic",
    );
    expect(deriveBackgroundBrief("anything", HUB_3D).motion).toBe("drift");
    expect(deriveBackgroundBrief("anything", HUB_2D).motion).toBe("calm");
    expect(
      deriveBackgroundBrief("a photoreal mountain landscape", HUB_3D)
        .wantsPhoto,
    ).toBe(true);
    expect(deriveBackgroundBrief("soft silver wash", HUB_3D).wantsPhoto).toBe(
      false,
    );
  });
});

describe("W-BG family choice (anti-repetition over the real corpus)", () => {
  const families = corpusLites();

  it("only background-capable families are eligible; 2d hubs exclude 3d-only families", () => {
    const brief3d = deriveBackgroundBrief("anything", HUB_3D);
    const c = chooseBackgroundFamily(families, brief3d, "anything", {});
    expect(c).toBeTruthy();
    expect(BACKGROUND_FAMILY_POOL).toContain(c!.familyId);

    const brief2d = deriveBackgroundBrief("anything", HUB_2D);
    // Run many rotations — a 3d-only family must never surface on a flat hub.
    const usage: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
      const pick = chooseBackgroundFamily(families, brief2d, "anything", usage);
      expect(pick).toBeTruthy();
      const doc = families.find((f) => f.id === pick!.familyId)!;
      expect(doc.renderModes, pick!.familyId).toContain("2d");
      usage[pick!.familyId] = (usage[pick!.familyId] ?? 0) + 1;
    }
  });

  it("an explicit ask overrides rotation (silk -> gpu-fluid-overlay)", () => {
    const brief = deriveBackgroundBrief("flowing liquid silk ribbons", HUB_3D);
    const c = chooseBackgroundFamily(
      families,
      brief,
      "flowing liquid silk ribbons",
      {
        "gpu-fluid-overlay": 99, // heavily used — the ask must still win
      },
    );
    expect(c!.familyId).toBe("gpu-fluid-overlay");
  });

  it("rotation prefers least-used and avoids the previous cluster (VARIATION)", () => {
    const brief = deriveBackgroundBrief("anything goes", HUB_3D);
    const first = chooseBackgroundFamily(families, brief, "anything goes", {});
    const second = chooseBackgroundFamily(
      families,
      brief,
      "anything goes",
      { [first!.familyId]: 1 },
      first!.clusterId,
    );
    expect(second!.familyId).not.toBe(first!.familyId);
    expect(second!.clusterId).not.toBe(first!.clusterId);
  });
});

describe("W-BG R1 synthesis (family vocabulary)", () => {
  const brief3d = deriveBackgroundBrief("warm ember drift", HUB_3D);
  const brief2d = deriveBackgroundBrief("quiet minimal ground", HUB_2D);

  it("synthesizes a valid, prefixed stack for every pool family", () => {
    for (const familyId of BACKGROUND_FAMILY_POOL) {
      const stack = synthesizeR1Stack(
        familyId,
        brief3d,
        "warm ember drift",
        "gen-test",
      );
      expect(stack.length, familyId).toBeGreaterThan(0);
      for (const layer of stack) {
        expect(layer.id.startsWith("gen-test-"), familyId).toBe(true);
        expect(BACKGROUND_LAYER_KIND_VALUES).toContain(layer.kind!);
        expect(layer.params?.palette).toBe("ember");
      }
    }
  });

  it("a flat hub gets a flat-native env (gradient wash, not a raymarch nebula)", () => {
    const flat = synthesizeR1Stack(
      "particle-field-hero",
      brief2d,
      "quiet minimal ground",
      "g2",
    );
    expect(flat.some((l) => l.kind === "gradient-volume")).toBe(true);
    expect(flat.some((l) => l.kind === "volumetric-nebula")).toBe(false);
    const deep = synthesizeR1Stack(
      "particle-field-hero",
      brief3d,
      "warm ember drift",
      "g3",
    );
    expect(deep.some((l) => l.kind === "volumetric-nebula")).toBe(true);
  });

  it("plate accents + generation names are well-formed", () => {
    const accents = synthesizePlateAccents(brief3d, "g4");
    expect(accents.length).toBeGreaterThan(0);
    expect(accents[0].kind).toBe("particle-field");
    expect(nameForGeneration(brief3d, "gpu-fluid-overlay")).toBe("Ember Flow");
  });
});
