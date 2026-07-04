// PRISM BRAND PROFILE — prism-brand.ts (SHELL W0, 2026-07-04)
//
// The Brand Profile a user establishes during Guided Build intake Phase 1
// (PRISM-FRONTEND-SHELL-SPEC.md §3) and that seeds direction boards, generated
// palettes, and typography choices downstream. ADDITIVE: fields only grow.
//
// Discipline:
//   - The logo is a REFERENCE (an asset id / storage key), never inline bytes.
//   - Palette entries are validated hex so a profile can safely feed both CSS
//     and THREE.Color without re-checking at every consumer.
//   - No secrets, no credentials — a brand profile is display data only (I5).

import { z } from 'zod';

/** Wire version of the Brand Profile schema. */
export const PRISM_BRAND_SCHEMA_VERSION = 1 as const;

/** #rgb / #rrggbb hex color. */
export const brandHexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'expected #rgb or #rrggbb hex');

/** Opaque reference to an uploaded/managed asset (storage key or asset id). */
export const brandAssetRefSchema = z.object({
  assetId: z.string().min(1),
  /** Optional MIME hint for renderers (e.g. image/svg+xml). */
  mimeType: z.string().min(1).optional(),
  /** Accessible name for the mark. */
  alt: z.string().optional(),
});
export type BrandAssetRef = z.infer<typeof brandAssetRefSchema>;

export const brandPaletteSchema = z.object({
  primary: brandHexColorSchema,
  secondary: brandHexColorSchema.optional(),
  accent: brandHexColorSchema.optional(),
  /** Ordered neutral ramp, darkest → lightest. */
  neutrals: z.array(brandHexColorSchema).max(12).optional(),
});
export type BrandPalette = z.infer<typeof brandPaletteSchema>;

/** Typography preferences — expressed as classification + optional named
 *  face, so intake can capture taste ("editorial serif") before a specific
 *  font is licensed/selected. */
export const brandTypePrefsSchema = z.object({
  display: z
    .object({
      classification: z.enum(['serif', 'slab', 'mono', 'script', 'display', 'geometric']),
      family: z.string().min(1).optional(),
    })
    .optional(),
  text: z
    .object({
      classification: z.enum(['serif', 'slab', 'mono', 'geometric', 'humanist']),
      family: z.string().min(1).optional(),
    })
    .optional(),
});
export type BrandTypePrefs = z.infer<typeof brandTypePrefsSchema>;

export const brandProfileSchema = z.object({
  v: z.literal(PRISM_BRAND_SCHEMA_VERSION),
  name: z.string().min(1).max(120),
  logo: brandAssetRefSchema.optional(),
  palette: brandPaletteSchema,
  typePrefs: brandTypePrefsSchema.optional(),
  /** Free-text tone descriptors ("confident", "playful", "clinical"). */
  toneDescriptors: z.array(z.string().min(1).max(60)).max(16),
});
export type BrandProfile = z.infer<typeof brandProfileSchema>;

/** Parse + validate an unknown value as a BrandProfile. */
export function parseBrandProfile(input: unknown): BrandProfile {
  return brandProfileSchema.parse(input);
}
