'use client';

// EDITOR-EXPERIENCE P3 (C15) — the bespoke PRISM brand mark.
//
// The brand's first impression must be the BEST-looking element, not the worst.
// This REPLACES the prior generic 4-point gold star (Icon name="sparkle"). It is
// a true prism: a glassy, brass-bevelled triangle that refracts an incoming ice
// beam into a warm dispersion fan (Observatory palette — brass→amber→ice; NO
// purple, by brand law). Faux-3D in the same single-key-light language as the
// icon system (lit top-left edge, shadowed flank, glass body, specular glint),
// and it is ALIVE: a slow GSAP dispersion shimmer at rest, and on hover the beam
// brightens, the fan spreads, and a specular streak sweeps the prism face.
//
// Palette is the frozen DS brass/ice ramp (tokens.ts): f7e9c6 / cd9f55 / 8f6930
// / ddba77 brass, a9c2d1 ice, on 0b0d13 ink — identical to the favicon (icon.svg)
// so the masthead mark and the OS favicon are one identity.

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
  const glintRef = React.useRef<SVGEllipseElement | null>(null);
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
    // the refracted fan breathes — opacity + a faint outward spread from the exit pivot
    tl.fromTo(
      fanRef.current,
      { opacity: 0.5, transformOrigin: '15px 13.5px', scaleX: 0.96, scaleY: 0.98 },
      { opacity: 1, scaleX: 1.04, scaleY: 1.06, duration: 2.4 },
      0,
    );
    // the entry glint twinkles a half-beat off
    tl.fromTo(
      glintRef.current,
      { opacity: 0.35, scale: 0.8, transformOrigin: '8px 13px' },
      { opacity: 0.95, scale: 1.15, duration: 1.6 },
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
    gsap.to(fanRef.current, { opacity: 1, scaleX: 1.12, scaleY: 1.14, duration: 0.4, ease: 'expo.out', transformOrigin: '15px 13.5px' });
    // specular streak sweeps across the prism face left→right, once
    gsap.fromTo(
      sweepRef.current,
      { attr: { transform: 'translate(-9 0)' }, opacity: 0 },
      { attr: { transform: 'translate(9 0)' }, opacity: 1, duration: 0.62, ease: 'power2.inOut',
        onComplete: () => gsap.to(sweepRef.current, { opacity: 0, duration: 0.2 }) },
    );
  }, []);

  const onLeave = React.useCallback(() => {
    gsap.to(rootRef.current, { scale: 1, duration: 0.45, ease: 'power3.out', transformOrigin: '12px 12px' });
    gsap.to(fanRef.current, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'power3.out', transformOrigin: '15px 13.5px' });
  }, []);

  // prism triangle (apex up), in 24×24 viewBox
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
      style={{ overflow: 'visible', filter: 'drop-shadow(0 1px 1.5px rgba(0,1,8,0.55))', ...style }}
      aria-label="Prism"
      role="img"
    >
      <defs>
        {/* brass bevel ramp for the prism edge — lit top → deep base */}
        <linearGradient id={`pl-edge-${uid}`} gradientUnits="userSpaceOnUse" x1="6" y1="4" x2="18" y2="20">
          <stop offset="0" stopColor="#fbf0d4" />
          <stop offset="0.42" stopColor="#ddba77" />
          <stop offset="0.74" stopColor="#cd9f55" />
          <stop offset="1" stopColor="#8f6930" />
        </linearGradient>
        {/* refractive glass body — cool ice top-left → warm amber base, low alpha */}
        <linearGradient id={`pl-body-${uid}`} gradientUnits="userSpaceOnUse" x1="6" y1="5" x2="17" y2="19">
          <stop offset="0" stopColor="#a9c2d1" stopOpacity="0.30" />
          <stop offset="0.5" stopColor="#cd9f55" stopOpacity="0.14" />
          <stop offset="1" stopColor="#8f6930" stopOpacity="0.22" />
        </linearGradient>
        {/* top-left specular wash on the face */}
        <linearGradient id={`pl-spec-${uid}`} gradientUnits="userSpaceOnUse" x1="7" y1="5" x2="15" y2="16">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* fan beam gradients (warm→cool, NO violet) */}
        <linearGradient id={`pl-b1-${uid}`} gradientUnits="userSpaceOnUse" x1="15" y1="13.5" x2="24" y2="10">
          <stop offset="0" stopColor="#fbf0d4" /><stop offset="1" stopColor="#f7e9c6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b2-${uid}`} gradientUnits="userSpaceOnUse" x1="15" y1="13.5" x2="24" y2="13">
          <stop offset="0" stopColor="#ddba77" /><stop offset="1" stopColor="#cd9f55" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b3-${uid}`} gradientUnits="userSpaceOnUse" x1="15" y1="13.5" x2="24" y2="16.5">
          <stop offset="0" stopColor="#a9c2d1" /><stop offset="1" stopColor="#a9c2d1" stopOpacity="0" />
        </linearGradient>
        <filter id={`pl-glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
        <clipPath id={`pl-clip-${uid}`}><path d={TRI} /></clipPath>
      </defs>

      {/* incoming ice beam → entering the left face */}
      <g filter={`url(#pl-glow-${uid})`} opacity="0.9">
        <line x1="0.5" y1="12.4" x2="8.6" y2="13.1" stroke="#a9c2d1" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <ellipse ref={glintRef} cx="8" cy="13" rx="1.5" ry="1.1" fill="#dbe8f0" filter={`url(#pl-glow-${uid})`} />

      {/* refracted dispersion fan → exiting the right face (warm→cool) */}
      <g ref={fanRef} filter={`url(#pl-glow-${uid})`}>
        <line x1="15" y1="13.5" x2="24.5" y2="9.6" stroke={`url(#pl-b1-${uid})`} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="15" y1="13.7" x2="25" y2="13" stroke={`url(#pl-b2-${uid})`} strokeWidth="1.7" strokeLinecap="round" />
        <line x1="15" y1="13.9" x2="24.5" y2="16.8" stroke={`url(#pl-b3-${uid})`} strokeWidth="1.5" strokeLinecap="round" />
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
      {/* brass bevelled edge — lit, ~1.9 wide */}
      <path d={TRI} fill="none" stroke={`url(#pl-edge-${uid})`} strokeWidth="1.9" strokeLinejoin="round" />
      {/* hairline rim keeps it crisp at masthead size */}
      <path d={TRI} fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="0.4" strokeLinejoin="round" />
    </svg>
  );
}
