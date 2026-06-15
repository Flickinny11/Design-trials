'use client';

// PRISM NODE-EDITOR V2 — real provider brand mark (criteria B2 / C1).
// Renders the PROVIDER'S REAL logo (official monochrome glyph from brand-assets)
// in the brand's accent, or a branded monogram chip for the long tail. NEVER a
// stock icon or fake logo (FORBIDDEN list). Used by Functions + Integrations.

import { getBrandAsset } from '@/lib/capabilities/brand-assets';

export default function BrandLogo({ brandKey, size = 18 }: { brandKey: string; size?: number }) {
  const b = getBrandAsset(brandKey);
  if (b.svgPath) {
    return (
      <span
        aria-label={b.name}
        style={{ display: 'inline-flex', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-hidden>
          <path d={b.svgPath} fill={b.accent} />
        </svg>
      </span>
    );
  }
  // Branded monogram chip (real brand color + initials) for the long tail.
  return (
    <span
      aria-label={b.name}
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Math.round(size * 0.28),
        background: b.accent,
        color: pickInk(b.accent),
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        fontFamily: 'ui-monospace, monospace',
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}
    >
      {(b.monogram || b.name.slice(0, 2)).slice(0, 3)}
    </span>
  );
}

// Choose dark/light ink for contrast against the brand accent.
function pickInk(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#0b0b0c';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? '#0b0b0c' : '#fdfcf7';
}
