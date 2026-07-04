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
}: {
  brandKey: string;
  size?: number;
}) {
  const asset = getBrandAsset(brandKey);
  if (asset.svgPath) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        role="img"
        aria-label={asset.name}
        className="ig-mark ig-mark--glyph"
      >
        <path d={asset.svgPath} fill={asset.accent} />
      </svg>
    );
  }
  return (
    <span
      className="ig-mark ig-mark--mono"
      role="img"
      aria-label={asset.name}
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
