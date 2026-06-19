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
      { opacity: 0.6, transformOrigin: '15px 13.6px', scaleX: 0.95, scaleY: 0.97 },
      { opacity: 1, scaleX: 1.05, scaleY: 1.08, duration: 2.4 },
      0,
    );
    // the arc-cyan core pulses a half-beat off
    tl.fromTo(
      coreRef.current,
      { opacity: 0.6, scale: 0.84, transformOrigin: '14.4px 13.7px' },
      { opacity: 1, scale: 1.14, duration: 1.6 },
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
    gsap.to(fanRef.current, { opacity: 1, scaleX: 1.14, scaleY: 1.18, duration: 0.4, ease: 'expo.out', transformOrigin: '15px 13.6px' });
    // specular streak sweeps across the prism face left->right, once
    gsap.fromTo(
      sweepRef.current,
      { attr: { transform: 'translate(-9 0)' }, opacity: 0 },
      { attr: { transform: 'translate(9 0)' }, opacity: 1, duration: 0.62, ease: 'power2.inOut',
        onComplete: () => gsap.to(sweepRef.current, { opacity: 0, duration: 0.2 }) },
    );
  }, []);

  const onLeave = React.useCallback(() => {
    gsap.to(rootRef.current, { scale: 1, duration: 0.45, ease: 'power3.out', transformOrigin: '12px 12px' });
    gsap.to(fanRef.current, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'power3.out', transformOrigin: '15px 13.6px' });
  }, []);

  // prism triangle (apex up), in 24x24 viewBox
  const TRI = 'M12 3.2 L20.4 19 L3.6 19 Z';

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
        <linearGradient id={`pl-edge-${uid}`} gradientUnits="userSpaceOnUse" x1="6" y1="4" x2="18" y2="20">
          <stop offset="0" stopColor="#eef0f3" />
          <stop offset="0.42" stopColor="#dfe2e6" />
          <stop offset="0.74" stopColor="#b8bcc0" />
          <stop offset="1" stopColor="#32363c" />
        </linearGradient>
        {/* refractive glass body — cool steel top-left -> arc-cyan -> anodized
            base, low alpha (translucent solid, not a flat fill) */}
        <linearGradient id={`pl-body-${uid}`} gradientUnits="userSpaceOnUse" x1="6" y1="5" x2="17" y2="19">
          <stop offset="0" stopColor="#aebccb" stopOpacity="0.30" />
          <stop offset="0.5" stopColor="#1ec8ff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#2d5fa3" stopOpacity="0.24" />
        </linearGradient>
        {/* top-left specular wash on the face */}
        <linearGradient id={`pl-spec-${uid}`} gradientUnits="userSpaceOnUse" x1="7" y1="5" x2="15" y2="16">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.52" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* CONTINUOUS dispersion fan — a graded angular sweep from the exit pivot:
            arc-hot -> arc-cyan -> ice -> anodized, fading to transparent at the
            exit. Two layers: a soft wide wedge (the continuous spectrum) + crisp
            spectral blades on top (the discrete refraction read). NO warm, NO
            violet — a strictly cool dispersion. */}
        <radialGradient id={`pl-fan-${uid}`} gradientUnits="userSpaceOnUse"
          cx="15" cy="13.6" r="11" fx="15" fy="13.6">
          <stop offset="0" stopColor="#bdecff" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#1ec8ff" stopOpacity="0.7" />
          <stop offset="0.62" stopColor="#5aa6e8" stopOpacity="0.42" />
          <stop offset="1" stopColor="#2d5fa3" stopOpacity="0" />
        </radialGradient>
        {/* spectral blade gradients — arc-hot (top) -> arc-cyan -> ice -> anodized (bottom) */}
        <linearGradient id={`pl-b1-${uid}`} gradientUnits="userSpaceOnUse" x1="15" y1="13.6" x2="25" y2="9.0">
          <stop offset="0" stopColor="#bdecff" /><stop offset="1" stopColor="#bdecff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b2-${uid}`} gradientUnits="userSpaceOnUse" x1="15" y1="13.6" x2="25" y2="10.8">
          <stop offset="0" stopColor="#96e0ff" /><stop offset="1" stopColor="#96e0ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b3-${uid}`} gradientUnits="userSpaceOnUse" x1="15" y1="13.6" x2="25.5" y2="13.0">
          <stop offset="0" stopColor="#1ec8ff" /><stop offset="1" stopColor="#1ec8ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b4-${uid}`} gradientUnits="userSpaceOnUse" x1="15" y1="13.6" x2="25" y2="15.4">
          <stop offset="0" stopColor="#6fb6e6" /><stop offset="1" stopColor="#6fb6e6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b5-${uid}`} gradientUnits="userSpaceOnUse" x1="15" y1="13.6" x2="24.5" y2="17.6">
          <stop offset="0" stopColor="#2d5fa3" /><stop offset="1" stopColor="#2d5fa3" stopOpacity="0" />
        </linearGradient>
        {/* arc-cyan core radial halo */}
        <radialGradient id={`pl-core-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#d6f3ff" />
          <stop offset="0.35" stopColor="#1ec8ff" />
          <stop offset="1" stopColor="#1ec8ff" stopOpacity="0" />
        </radialGradient>
        <filter id={`pl-glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
        <filter id={`pl-soft-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <clipPath id={`pl-clip-${uid}`}><path d={TRI} /></clipPath>
      </defs>

      {/* incoming cool collimated beam -> entering the left face */}
      <g filter={`url(#pl-glow-${uid})`} opacity="0.92">
        <line x1="0.5" y1="12.3" x2="8.6" y2="13.1" stroke="#dfe2e6" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="1.5" y1="12.5" x2="8.2" y2="13.0" stroke="#bdecff" strokeWidth="0.7" strokeLinecap="round" opacity="0.7" />
      </g>

      {/* refracted dispersion fan -> exiting the right face. The fan group is the
          animated element (idle breathe + hover spread, pivoting at the exit). */}
      <g ref={fanRef}>
        {/* continuous spectrum wedge (soft, wide) — the unmistakable dispersion */}
        <path
          d="M15 13.6 L25 8.4 L26 13 L24.6 18.2 Z"
          fill={`url(#pl-fan-${uid})`}
          filter={`url(#pl-soft-${uid})`}
          opacity="0.9"
        />
        {/* crisp spectral blades on top (the discrete refraction read) */}
        <g filter={`url(#pl-glow-${uid})`}>
          <line x1="15" y1="13.6" x2="25" y2="9.0" stroke={`url(#pl-b1-${uid})`} strokeWidth="1.4" strokeLinecap="round" />
          <line x1="15" y1="13.6" x2="25" y2="10.8" stroke={`url(#pl-b2-${uid})`} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="15" y1="13.6" x2="25.5" y2="13.0" stroke={`url(#pl-b3-${uid})`} strokeWidth="1.7" strokeLinecap="round" />
          <line x1="15" y1="13.6" x2="25" y2="15.4" stroke={`url(#pl-b4-${uid})`} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="15" y1="13.6" x2="24.5" y2="17.6" stroke={`url(#pl-b5-${uid})`} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      </g>

      {/* prism solid: translucent refractive body */}
      <path d={TRI} fill={`url(#pl-body-${uid})`} />
      {/* top-left specular wash */}
      <path d={TRI} fill={`url(#pl-spec-${uid})`} />
      {/* sweeping specular streak (hover) — clipped to the prism face */}
      <g clipPath={`url(#pl-clip-${uid})`}>
        <g ref={sweepRef} opacity="0">
          <rect x="9" y="2" width="2.4" height="20" fill="#ffffff" opacity="0.5" transform="skewX(-18)" />
        </g>
      </g>
      {/* arc-cyan emissive core — the single emission, at the refraction pivot:
          a radial halo + a hot center, so the split clearly originates here */}
      <g ref={coreRef}>
        <circle cx="14.4" cy="13.7" r="3.2" fill={`url(#pl-core-${uid})`} opacity="0.85" />
        <circle cx="14.4" cy="13.7" r="1.15" fill="#1ec8ff" filter={`url(#pl-glow-${uid})`} />
        <circle cx="14.4" cy="13.7" r="0.5" fill="#eafaff" />
      </g>
      {/* chrome bevelled edge — lit, ~1.9 wide */}
      <path d={TRI} fill="none" stroke={`url(#pl-edge-${uid})`} strokeWidth="1.9" strokeLinejoin="round" />
      {/* hairline rim keeps it crisp at masthead size */}
      <path d={TRI} fill="none" stroke="#eef0f3" strokeOpacity="0.24" strokeWidth="0.4" strokeLinejoin="round" />
    </svg>
  );
}
