// PRISM MARKETING — STATIC POSTERS (SHELL W6, DL8/DL10)
//
// The instant-paint stills behind every 3D island. The hero poster is the
// LCP-eligible element (server-rendered, no canvas) and the permanent fallback
// for reduced-data / low-GPU / no-WebGL devices. Rendered as crafted SVG in
// the RED/BLACK/WHITE identity (DL2) with light-simulating gradients so the
// hand-off to the live scene is seamless. Decorative — marked aria-hidden; the
// meaning is carried by adjacent copy (WCAG 1.1.1).
//
// The <stop>/fill hexes below are the premium.ts identity values (SIGNAL_RED
// #ff2a38, RED_HOT #ff5a55, RED_DEEP #7d0f18, CHROME_HI #f6f8fb, CHROME
// #e8ecf2, CHROME_LO #9aa1ac, GUNMETAL_DEEP #0b0b10) inlined literally because
// SVG gradient stops cannot read CSS custom properties in a server-rendered
// still. They MIRROR the single token source — keep in lockstep with
// src/components/shell/design/prism-premium-tokens.ts (DL2).

/** Full hero still — the FORGE composition the live scene animates into: a
 *  glass prism over the machined guilloche pedestal, wrapped in a galaxy disc
 *  of motes that grade from chrome at the rim to signal red at the core. */
export function HeroPoster() {
  // Deterministic mote field (no Math.random — the still must be stable).
  const motes: { x: number; y: number; r: number; o: number; red: boolean }[] = [];
  for (let i = 0; i < 130; i++) {
    const a = i * 2.399963;
    const rr = 40 + ((i * 0.754 + 0.13) % 1) ** 0.5 * 250;
    const x = 265 + Math.cos(a) * rr;
    const y = 205 + Math.sin(a) * rr * 0.3 - rr * 0.04;
    if (x < -10 || x > 660 || y < 0 || y > 400) continue;
    const close = 1 - Math.min(1, rr / 290);
    motes.push({ x, y, r: 0.9 + close * 1.7, o: 0.25 + close * 0.65, red: close > 0.35 });
  }
  return (
    <svg
      className="mk-hero-poster"
      viewBox="0 0 650 400"
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="mkh-glow" cx="41%" cy="46%" r="46%">
          <stop offset="0%" stopColor="#ff2a38" stopOpacity="0.30" />
          <stop offset="60%" stopColor="#ff2a38" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mkh-chrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6f8fb" />
          <stop offset="45%" stopColor="#9aa1ac" />
          <stop offset="100%" stopColor="#3a3f47" />
        </linearGradient>
        <linearGradient id="mkh-gun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b2b35" />
          <stop offset="100%" stopColor="#0b0b10" />
        </linearGradient>
        <linearGradient id="mkh-red" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#ff5a55" />
          <stop offset="55%" stopColor="#ff2a38" />
          <stop offset="100%" stopColor="#7d0f18" />
        </linearGradient>
        <linearGradient id="mkh-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6f8fb" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#ffb3ae" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#7d0f18" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="650" height="400" fill="url(#mkh-glow)" />

      {/* galaxy disc of motes */}
      <g>
        {motes.map((m, i) => (
          <circle
            key={i}
            cx={m.x}
            cy={m.y}
            r={m.r}
            fill={m.red ? '#ff5a55' : '#e8ecf2'}
            opacity={m.o}
          />
        ))}
      </g>

      {/* marble plinth + machined pedestal */}
      <rect x="163" y="306" width="204" height="22" rx="4" fill="url(#mkh-gun)" />
      <ellipse cx="265" cy="300" rx="78" ry="16" fill="url(#mkh-gun)" />
      <ellipse cx="265" cy="292" rx="62" ry="12" fill="url(#mkh-chrome)" opacity="0.55" />
      <ellipse cx="265" cy="288" rx="56" ry="10" fill="#14141a" />
      <g stroke="#3a3f47" strokeWidth="0.8" fill="none" opacity="0.8">
        <ellipse cx="265" cy="288" rx="44" ry="7.6" />
        <ellipse cx="265" cy="288" rx="32" ry="5.4" />
        <ellipse cx="265" cy="288" rx="20" ry="3.2" />
      </g>

      {/* dispersive glass prism + hot core */}
      <g transform="translate(265 196)">
        <polygon points="0,-72 58,44 -58,44" fill="url(#mkh-glass)" />
        <polygon points="0,-72 58,44 0,44" fill="#ffffff" opacity="0.14" />
        <polygon points="0,-16 16,14 -16,14" fill="url(#mkh-red)" />
        <circle cx="0" cy="6" r="7" fill="#ff5a55" />
      </g>
    </svg>
  );
}

/** Small centered mark used behind icon / thumbnail islands until they mount.
 *  A faceted chrome-and-red glyph, decorative. `accent` tints the core. */
export function MarkPoster({ accent = '#ff2a38' }: { accent?: string }) {
  return (
    <svg
      className="mk-mark-poster"
      viewBox="0 0 100 100"
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id={`mkm-c-${accent}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6f8fb" />
          <stop offset="100%" stopColor="#4a4f57" />
        </linearGradient>
      </defs>
      <polygon points="50,20 74,50 50,80 26,50" fill={`url(#mkm-c-${accent})`} opacity="0.65" />
      <polygon points="50,36 62,50 50,64 38,50" fill={accent} />
    </svg>
  );
}
