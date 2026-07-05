'use client';

// PRISM PORT F1 (dispersive-mark upgrade 2026-06-19) — the bespoke PRISM mark.
//
// The brand's first impression must be the BEST-looking element, not the worst.
// F1 closes the F0 reviewer gap (the mark read flat / chrome-only): the mark is
// now an UNMISTAKABLE DISPERSIVE prism — a machined-chrome refractive triangle
// that splits an incoming cool collimated beam into a CONTINUOUS arc-cyan -> cool
// spectrum FAN (a graded wedge of spectral blades, not three lines) with an
// arc-cyan emissive CORE + halo at the refraction pivot, an exit caustic, real
// chrome bevel (top-lit highlight + bottom shadow = measurable Z-thickness), and
// a translucent refractive body. It is ALIVE: a slow GSAP dispersion shimmer at
// rest (the fan breathes + spreads, the core pulses), and on hover the beam
// brightens, the fan spreads wider, and a specular streak sweeps the prism face.
//
// Palette is the locked DS identity (tokens.ts): chrome #dfe2e6 / titanium
// #b8bcc0 / mercury #eef0f3 metal, arc-cyan #1ec8ff (the single emissive
// accent) + anodized #2d5fa3 tint, on substrate #0d1117 — identical to the
// favicon (icon.svg) so the masthead mark and the OS favicon are one identity.
// ZERO brass/gold/amber. NO purple. NOT a star. The spectrum fan is a COOL
// dispersion (arc-hot -> arc-cyan -> ice -> anodized), never a warm rainbow.

import * as React from 'react';
import gsap from 'gsap';

interface PrismLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function PrismLogo({ size = 22, className, style }: PrismLogoProps) {
  const uid = React.useId().replace(/:/g, '');
  const rootRef = React.useRef<SVGSVGElement | null>(null);
  const fanRef = React.useRef<SVGGElement | null>(null);
  const sweepRef = React.useRef<SVGGElement | null>(null);
  const coreRef = React.useRef<SVGGElement | null>(null);
  const idleTl = React.useRef<gsap.core.Timeline | null>(null);

  // Idle dispersion shimmer (respects prefers-reduced-motion).
  React.useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      gsap.set(fanRef.current, { opacity: 0.9 });
      return;
    }
    const tl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } });
    // the refracted fan breathes — opacity + a faint angular spread from the exit pivot
    tl.fromTo(
      fanRef.current,
      { opacity: 0.62, transformOrigin: '12.6px 13.6px', scaleX: 0.94, scaleY: 0.96 },
      { opacity: 1, scaleX: 1.06, scaleY: 1.1, duration: 2.4 },
      0,
    );
    // the arc-cyan core pulses a half-beat off
    tl.fromTo(
      coreRef.current,
      { opacity: 0.62, scale: 0.84, transformOrigin: '12.6px 13.6px' },
      { opacity: 1, scale: 1.16, duration: 1.6 },
      0.4,
    );
    idleTl.current = tl;
    return () => {
      tl.kill();
    };
  }, []);

  const onEnter = React.useCallback(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.to(rootRef.current, { scale: 1.07, duration: 0.32, ease: 'expo.out', transformOrigin: '12px 12px' });
    if (reduce) return;
    // fan spreads + brightens
    gsap.to(fanRef.current, { opacity: 1, scaleX: 1.16, scaleY: 1.2, duration: 0.4, ease: 'expo.out', transformOrigin: '12.6px 13.6px' });
    // specular streak sweeps across the prism face left->right, once
    gsap.fromTo(
      sweepRef.current,
      { attr: { transform: 'translate(-7 0)' }, opacity: 0 },
      { attr: { transform: 'translate(7 0)' }, opacity: 1, duration: 0.62, ease: 'power2.inOut',
        onComplete: () => gsap.to(sweepRef.current, { opacity: 0, duration: 0.2 }) },
    );
  }, []);

  const onLeave = React.useCallback(() => {
    gsap.to(rootRef.current, { scale: 1, duration: 0.45, ease: 'power3.out', transformOrigin: '12px 12px' });
    gsap.to(fanRef.current, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'power3.out', transformOrigin: '12.6px 13.6px' });
  }, []);

  // F2 recompose — the prism sits in the LEFT-CENTER of the 24x24 viewBox so the
  // dispersion fan has room to splay RIGHT and stay inside the visible frame at
  // 18px masthead size (the prior apex-centered layout pushed the fan off-chip).
  // Apex up; a chunky equilateral-ish prism.
  const TRI = 'M9 3.6 L15.6 18.4 L2.4 18.4 Z';

  return (
    <svg
      ref={rootRef}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ overflow: 'visible', filter: 'drop-shadow(0 1px 1.5px rgba(0,1,8,0.6))', ...style }}
      aria-label="Prism"
      role="img"
    >
      <defs>
        {/* chrome bevel ramp for the prism edge — lit mercury top -> chrome ->
            titanium -> graphite shadow base (real Z: highlight TL, shadow BR) */}
        <linearGradient id={`pl-edge-${uid}`} gradientUnits="userSpaceOnUse" x1="3" y1="4" x2="15" y2="19">
          <stop offset="0" stopColor="#eef0f3" />
          <stop offset="0.42" stopColor="#dfe2e6" />
          <stop offset="0.74" stopColor="#b8bcc0" />
          <stop offset="1" stopColor="#32363c" />
        </linearGradient>
        {/* refractive glass body — cool steel top-left -> arc-cyan -> anodized
            base, low alpha (translucent solid, not a flat fill) */}
        <linearGradient id={`pl-body-${uid}`} gradientUnits="userSpaceOnUse" x1="3" y1="5" x2="14" y2="18">
          <stop offset="0" stopColor="#aebccb" stopOpacity="0.30" />
          <stop offset="0.5" stopColor="#1ec8ff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#2d5fa3" stopOpacity="0.24" />
        </linearGradient>
        {/* top-left specular wash on the face */}
        <linearGradient id={`pl-spec-${uid}`} gradientUnits="userSpaceOnUse" x1="4" y1="5" x2="12" y2="16">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.52" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* CONTINUOUS dispersion fan (F2 recompose — reads AT 18px masthead):
            the prism sits LEFT-of-center, the exit pivot is on its right vertex
            (~12.6,13.6), and the spectrum splays RIGHT in a WIDE, BRIGHT fan that
            stays inside the visible frame (x<=23) instead of spilling off-chip.
            white/ice -> arc-hot -> arc-cyan -> steel -> anodized, NO warm, NO
            violet — a strictly cool dispersion. Soft wide wedge (continuous,
            low alpha) + five crisp distinct-hue blades (the refraction read). */}
        <radialGradient id={`pl-fan-${uid}`} gradientUnits="userSpaceOnUse"
          cx="12.6" cy="13.6" r="10" fx="12.6" fy="13.6">
          <stop offset="0" stopColor="#dff6ff" stopOpacity="1" />
          <stop offset="0.34" stopColor="#1ec8ff" stopOpacity="0.85" />
          <stop offset="0.68" stopColor="#5aa6e8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#2d5fa3" stopOpacity="0" />
        </radialGradient>
        {/* spectral blade gradients — arc-hot (top) -> arc-cyan -> ice ->
            anodized (bottom). Pivot (12.6,13.6); blades splay RIGHT, ending
            inside the frame (x<=22) so the fan reads at masthead size. */}
        <linearGradient id={`pl-b1-${uid}`} gradientUnits="userSpaceOnUse" x1="12.6" y1="13.6" x2="21.8" y2="4.2">
          <stop offset="0.12" stopColor="#ffffff" /><stop offset="1" stopColor="#eafaff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b2-${uid}`} gradientUnits="userSpaceOnUse" x1="12.6" y1="13.6" x2="22.8" y2="8.4">
          <stop offset="0.12" stopColor="#96e0ff" /><stop offset="1" stopColor="#96e0ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b3-${uid}`} gradientUnits="userSpaceOnUse" x1="12.6" y1="13.6" x2="23.2" y2="13.2">
          <stop offset="0.12" stopColor="#1ec8ff" /><stop offset="1" stopColor="#1ec8ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b4-${uid}`} gradientUnits="userSpaceOnUse" x1="12.6" y1="13.6" x2="22.8" y2="17.8">
          <stop offset="0.12" stopColor="#4f8fd4" /><stop offset="1" stopColor="#4f8fd4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b5-${uid}`} gradientUnits="userSpaceOnUse" x1="12.6" y1="13.6" x2="21.8" y2="21.6">
          <stop offset="0.12" stopColor="#2d5fa3" /><stop offset="1" stopColor="#2d5fa3" stopOpacity="0" />
        </linearGradient>
        {/* arc-cyan core radial halo */}
        <radialGradient id={`pl-core-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#d6f3ff" />
          <stop offset="0.35" stopColor="#1ec8ff" />
          <stop offset="1" stopColor="#1ec8ff" stopOpacity="0" />
        </radialGradient>
        <filter id={`pl-glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.42" />
        </filter>
        <filter id={`pl-soft-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <clipPath id={`pl-clip-${uid}`}><path d={TRI} /></clipPath>
      </defs>

      {/* incoming cool collimated beam -> entering the prism's lower-left face */}
      <g filter={`url(#pl-glow-${uid})`} opacity="0.92">
        <line x1="0.4" y1="14.4" x2="6.4" y2="13.9" stroke="#dfe2e6" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="1.2" y1="14.5" x2="6.2" y2="14.0" stroke="#bdecff" strokeWidth="0.7" strokeLinecap="round" opacity="0.7" />
      </g>

      {/* refracted dispersion fan -> splaying off the prism's lower-right face.
          The fan group is the animated element (idle breathe + hover spread,
          pivoting at the exit ~17,15.6). Recomposed so the spectrum reads inside
          the visible frame at masthead size. */}
      <g ref={fanRef}>
        {/* continuous spectrum wedge (soft, wide) — the unmistakable dispersion,
            a broad cool rainbow wedge hinged at the exit pivot, splaying right */}
        <path
          d="M12.6 13.6 L21.8 4.4 L23.0 13.0 L21.6 21.4 Z"
          fill={`url(#pl-fan-${uid})`}
          filter={`url(#pl-soft-${uid})`}
          opacity="0.6"
        />
        {/* crisp spectral blades on top (the discrete refraction read) — five
            distinct cool hues (white -> arc-hot -> arc-cyan -> steel -> anodized)
            splayed across a wide angle so they separate at masthead size. */}
        <g filter={`url(#pl-glow-${uid})`}>
          <line x1="12.6" y1="13.6" x2="21.8" y2="4.6" stroke={`url(#pl-b1-${uid})`} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12.6" y1="13.6" x2="22.8" y2="8.6" stroke={`url(#pl-b2-${uid})`} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="12.6" y1="13.6" x2="23.2" y2="13.2" stroke={`url(#pl-b3-${uid})`} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="12.6" y1="13.6" x2="22.8" y2="17.6" stroke={`url(#pl-b4-${uid})`} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="12.6" y1="13.6" x2="21.8" y2="21.4" stroke={`url(#pl-b5-${uid})`} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </g>

      {/* prism solid: translucent refractive body */}
      <path d={TRI} fill={`url(#pl-body-${uid})`} />
      {/* top-left specular wash */}
      <path d={TRI} fill={`url(#pl-spec-${uid})`} />
      {/* sweeping specular streak (hover) — clipped to the prism face */}
      <g clipPath={`url(#pl-clip-${uid})`}>
        <g ref={sweepRef} opacity="0">
          <rect x="5" y="1" width="2.2" height="22" fill="#ffffff" opacity="0.5" transform="skewX(-18)" />
        </g>
      </g>
      {/* arc-cyan emissive core — the single emission, at the refraction pivot
          on the prism's right face: a radial halo + a hot center, so the split
          clearly ORIGINATES here and the fan reads as light leaving the prism. */}
      <g ref={coreRef}>
        <circle cx="12.6" cy="13.6" r="3.4" fill={`url(#pl-core-${uid})`} opacity="0.9" />
        <circle cx="12.6" cy="13.6" r="1.25" fill="#1ec8ff" filter={`url(#pl-glow-${uid})`} />
        <circle cx="12.6" cy="13.6" r="0.55" fill="#eafaff" />
      </g>
      {/* chrome bevelled edge — lit, ~1.9 wide */}
      <path d={TRI} fill="none" stroke={`url(#pl-edge-${uid})`} strokeWidth="1.9" strokeLinejoin="round" />
      {/* hairline rim keeps it crisp at masthead size */}
      <path d={TRI} fill="none" stroke="#eef0f3" strokeOpacity="0.24" strokeWidth="0.4" strokeLinejoin="round" />
    </svg>
  );
}
