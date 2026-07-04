'use client';

// PRISM SHELL — REAL 2D BRAND MARK (SHELL W3, DL15)
//
// DL15 is DL5's sole exception: where a third-party brand appears, show the
// REAL brand mark, never a stock icon or a fake logo. The catalog + connected-
// account lists + the white-label Connect modal are WORKING surfaces (DL10:
// clean-but-premium, 3D reserved for the hero), so the mark is the provider's
// real monochrome glyph — rendered in its official accent — or a branded
// monogram chip when no glyph is vendored. Source of truth: brand-assets.ts
// (the same real glyphs the node-editor catalog uses).

import { getBrandAsset } from '@/lib/capabilities/brand-assets';

export default function BrandMark2D({
  brandKey,
  size = 28,
  /** When the mark sits beside a text label that already names the brand, mark
   *  it decorative so screen readers don't announce the brand twice. */
  decorative = false,
}: {
  brandKey: string;
  size?: number;
  decorative?: boolean;
}) {
  const asset = getBrandAsset(brandKey);
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': asset.name };
  if (asset.svgPath) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        {...a11y}
        className="ig-mark ig-mark--glyph"
      >
        <path d={asset.svgPath} fill={asset.accent} />
      </svg>
    );
  }
  return (
    <span
      className="ig-mark ig-mark--mono"
      {...a11y}
      style={{
        width: size,
        height: size,
        // The provider's real accent, framing its initials — real brand
        // identity, not a stock placeholder.
        ['--ig-mono-accent' as string]: asset.accent,
      }}
    >
      {asset.monogram ?? asset.name.slice(0, 2)}
    </span>
  );
}
