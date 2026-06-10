'use client';

// PRISM EDITOR DESIGN SYSTEM — RefractionDefs (Wave 0).
//
// The SVG displacement filter behind `.ds-glass--refract`: backdrop pixels
// bend at the panel rim like the edge of real polished glass (Liquid-Glass
// technique: feImage displacement map → feDisplacementMap → soft blur).
// The map is a data-URI SVG — neutral rgb(128,128,128) plateau in the middle
// (no displacement) ramping to directional offsets at the rim, stretched to
// the element via objectBoundingBox filter units.
//
// Chromium-only (`backdrop-filter: url()`); materials.css guards it behind
// @supports + html[data-ds-tier='t2']. Mount ONCE per page, anywhere in the
// tree. Apply to hero surfaces only (≤3 per viewport): detail panel, search
// palette, toolbar dock.

const MAP_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">` +
    // Base: full-range X ramp in red, Y ramp in green (linear refraction field)
    `<defs>` +
    `<linearGradient id="x" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#ff8080"/><stop offset="1" stop-color="#008080"/>` +
    `</linearGradient>` +
    `<linearGradient id="y" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#80ff80"/><stop offset="1" stop-color="#800080"/>` +
    `</linearGradient>` +
    // Radial mask: neutral center plateau, ramps engage only near the rim
    `<radialGradient id="m" cx="0.5" cy="0.5" r="0.72">` +
    `<stop offset="0" stop-color="#fff"/><stop offset="0.62" stop-color="#fff"/>` +
    `<stop offset="1" stop-color="#000"/>` +
    `</radialGradient>` +
    `<mask id="edge"><rect width="128" height="128" fill="#fff"/>` +
    `<rect width="128" height="128" fill="url(#m)"/></mask>` +
    `</defs>` +
    `<rect width="128" height="128" fill="#808080"/>` +
    `<g mask="url(#edge)">` +
    `<rect width="128" height="128" fill="url(#x)"/>` +
    `<rect width="128" height="128" fill="url(#y)" opacity="0.5"/>` +
    `</g>` +
    `</svg>`,
);

export default function RefractionDefs() {
  return (
    <svg aria-hidden width={0} height={0} style={{ position: 'absolute' }}>
      <filter
        id="ds-refract"
        x="0"
        y="0"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
        primitiveUnits="objectBoundingBox"
        colorInterpolationFilters="sRGB"
      >
        {/* Frost first, then bend the frosted backdrop at the rim. */}
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.022" result="frost" />
        <feImage
          href={`data:image/svg+xml,${MAP_SVG}`}
          x="0"
          y="0"
          width="1"
          height="1"
          preserveAspectRatio="none"
          result="map"
        />
        <feDisplacementMap
          in="frost"
          in2="map"
          scale="0.16"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
