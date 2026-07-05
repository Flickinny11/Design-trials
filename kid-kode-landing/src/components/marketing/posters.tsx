// PRISM MARKETING — STATIC POSTERS (SHELL W6, DL8/DL10)
//
// The instant-paint stills behind every 3D island. The hero poster is the
// LCP-eligible element (server-rendered, no canvas) and the permanent fallback
// for reduced-data / low-GPU / no-WebGL devices. Rendered as crafted SVG in
// the RED/BLACK/WHITE identity (DL2) with light-simulating gradients so the
// hand-off to the live scene is seamless. Decorative — marked aria-hidden; the
// meaning is carried by adjacent copy (WCAG 1.1.1).

/** Full hero still: machined pedestal, chrome gyroscope, rising red prism,
 *  red graph wiring — the same composition the live scene animates into. */
export function HeroPoster() {
  return (
    <svg
      className="mk-hero-poster"
      viewBox="0 0 400 400"
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="mkh-glow" cx="58%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ff2a38" stopOpacity="0.28" />
          <stop offset="60%" stopColor="#ff2a38" stopOpacity="0.05" />
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
      </defs>

      <rect x="0" y="0" width="400" height="400" fill="url(#mkh-glow)" />

      {/* graph wiring */}
      <g stroke="#ff2a38" strokeOpacity="0.4" strokeWidth="1">
        <line x1="200" y1="190" x2="96" y2="150" />
        <line x1="200" y1="190" x2="308" y2="150" />
        <line x1="200" y1="190" x2="120" y2="250" />
        <line x1="200" y1="190" x2="290" y2="248" />
        <line x1="200" y1="190" x2="200" y2="112" />
      </g>
      {[
        [96, 150], [308, 150], [120, 250], [290, 248], [200, 112],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="url(#mkh-chrome)" />
      ))}

      {/* pedestal */}
      <ellipse cx="200" cy="300" rx="96" ry="24" fill="url(#mkh-gun)" />
      <ellipse cx="200" cy="292" rx="70" ry="16" fill="url(#mkh-chrome)" opacity="0.85" />

      {/* gyroscope rings */}
      <ellipse cx="200" cy="196" rx="118" ry="42" fill="none" stroke="url(#mkh-chrome)" strokeWidth="3" opacity="0.85" transform="rotate(-16 200 196)" />
      <ellipse cx="200" cy="196" rx="96" ry="112" fill="none" stroke="#e8ecf2" strokeOpacity="0.5" strokeWidth="2" transform="rotate(24 200 196)" />

      {/* rising red prism */}
      <g transform="translate(200 168)">
        <polygon points="0,-58 52,0 0,58 -52,0" fill="url(#mkh-red)" />
        <polygon points="0,-58 52,0 0,0" fill="#ff2a38" opacity="0.55" />
        <polygon points="0,-20 18,0 0,20 -18,0" fill="#ff5a55" />
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
