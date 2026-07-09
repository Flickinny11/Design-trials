// PRISM SHELL — GENERATED BACKGROUND LIBRARY CONTRACT — prism-backgrounds.ts
// (SHELL W-BG)
//
// Contract-first shapes for the per-tenant generated-background library:
// prompt-to-background produces a SavedBackgroundItem (a named, provenance-
// tagged `PrismHub.background` layer stack) that persists in the tenant store
// and resurfaces in the picker's MY LIBRARY section. Layer assets are PUBLIC
// urls only (INV-R13 — never a secret, never a provider token); the layer
// shape mirrors `PrismHubBackgroundLayer` (prism-graph) field-for-field so an
// item applies to a hub without translation.

import { z } from "zod";

export const savedBackgroundLayerSchema = z.object({
  id: z.string().min(1).max(160),
  attachment: z.enum([
    "viewport-fixed",
    "camera-locked",
    "parallax",
    "world",
    "infinite-environment",
  ]),
  kind: z
    .enum([
      "image",
      "volumetric-nebula",
      "particle-field",
      "parallax-plane",
      "splat",
      "gradient-volume",
      "fluid-overlay",
    ])
    .optional(),
  sourceUrl: z.string().max(500).nullish(),
  depthMapUrl: z.string().max(500).nullish(),
  z: z.number().optional(),
  opacity: z.number().optional(),
  parallaxDepth: z.number().optional(),
  renderMode: z.string().max(40).optional(),
  presetId: z.string().max(160).optional(),
  minTier: z.enum(["T0", "T1", "T2"]).optional(),
  params: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});
export type SavedBackgroundLayer = z.infer<typeof savedBackgroundLayerSchema>;

export const savedBackgroundItemSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  /** The user's prompt (display copy in MY LIBRARY; PII-scrubbed telemetry
   *  goes through the flight recorder separately). */
  prompt: z.string().max(2000),
  /** Which render route realized it (W-PHOTO vocabulary; R4 is not a
   *  generation target — DEV-6). */
  route: z.enum(["R1", "R2", "R3"]),
  /** design-grammar family the generation drew on (anti-repetition axis). */
  grammarFamily: z.string().min(1).max(120),
  /** The family's antiRepetition cluster at generation time. */
  clusterId: z.string().max(120).optional(),
  palette: z.string().max(60),
  renderMode: z.enum(["2d", "3d"]),
  createdAt: z.string().datetime(),
  layers: z.array(savedBackgroundLayerSchema).min(1).max(8),
  /** True when a photo route was planned but realized as R1 (no provider
   *  key) — the honest-downgrade flag (DEV-4). */
  downgraded: z.boolean().optional(),
  notice: z.string().max(500).optional(),
});
export type SavedBackgroundItemRecord = z.infer<
  typeof savedBackgroundItemSchema
>;
