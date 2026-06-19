'use client';

// PRISM PORT F0 (de-brassed 2026-06-19) — the bespoke dispersive PRISM mark.
//
// The brand's first impression must be the BEST-looking element, not the worst.
// This REPLACES the CONDEMNED gold-star / brass-prism mark. It is a true
// DISPERSIVE prism: a machined-chrome refractive triangle that splits an
// incoming cool collimated beam into an ARC-CYAN -> cool spectrum fan on a
// near-black substrate. Dimensional in the single-key-light material language
// (top highlight + bottom shadow = real Z-thickness, chrome bevel, translucent
// glass body, arc-cyan emissive core, specular glint), and it is ALIVE: a slow
// GSAP dispersion shimmer at rest, and on hover the beam brightens, the fan
// spreads, and a specular streak sweeps the prism face.
//
// Palette is the locked DS identity (tokens.ts): chrome #dfe2e6 / titanium
// #b8bcc0 / mercury #eef0f3 metal, arc-cyan #1ec8ff (the single emissive
// accent) + anodized #2d5fa3 tint, on substrate #0d1117 — identical to the
// favicon (icon.svg) so the masthead mark and the OS favicon are one identity.
// ZERO brass/gold/amber. NO purple. NOT a star.
//
// NOTE: this is the dimensional 2D port of the slice's hero dispersive prism.
// A full WebGL/R3F refractive-solid upgrade (transmission + real dispersion +
// mirror-chrome yoke ring) is flagged for the F1/F2 increment.

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
  const coreRef = React.useRef<SVGCircleElement | null>(null);
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
      { opacity: 0.55, transformOrigin: '15px 13.5px', scaleX: 0.96, scaleY: 0.98 },
      { opacity: 1, scaleX: 1.04, scaleY: 1.06, duration: 2.4 },
      0,
    );
    // the arc-cyan core pulses a half-beat off
    tl.fromTo(
      coreRef.current,
      { opacity: 0.55, scale: 0.82, transformOrigin: '12px 14px' },
      { opacity: 1, scale: 1.12, duration: 1.6 },
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
    gsap.to(fanRef.current, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'power3.out', transformOrigin: '15px 13.5px' });
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
        {/* chrome bevel ramp for the prism edge — lit mercury top -> titanium ->
            graphite shadow base (real Z: highlight TL, shadow BR) */}
        <linearGradient id={`pl-edge-${uid}`} gradientUnits="userSpaceOnUse" x1="6" y1="4" x2="18" y2="20">
          <stop offset="0" stopColor="#eef0f3" />
          <stop offset="0.42" stopColor="#dfe2e6" />
          <stop offset="0.74" stopColor="#b8bcc0" />
          <stop offset="1" stopColor="#32363c" />
        </linearGradient>
        {/* refractive glass body — cool steel top-left -> arc-cyan -> anodized
            base, low alpha (translucent solid, not a flat fill) */}
        <linearGradient id={`pl-body-${uid}`} gradientUnits="userSpaceOnUse" x1="6" y1="5" x2="17" y2="19">
          <stop offset="0" stopColor="#aebccb" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#1ec8ff" stopOpacity="0.13" />
          <stop offset="1" stopColor="#2d5fa3" stopOpacity="0.22" />
        </linearGradient>
        {/* top-left specular wash on the face */}
        <linearGradient id={`pl-spec-${uid}`} gradientUnits="userSpaceOnUse" x1="7" y1="5" x2="15" y2="16">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* fan beam gradients — arc-cyan -> cool spectrum (NO warm, NO violet) */}
        <linearGradient id={`pl-b1-${uid}`} gradientUnits="userSpaceOnUse" x1="15" y1="13.5" x2="24" y2="10">
          <stop offset="0" stopColor="#96e0ff" /><stop offset="1" stopColor="#96e0ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b2-${uid}`} gradientUnits="userSpaceOnUse" x1="15" y1="13.5" x2="24" y2="13">
          <stop offset="0" stopColor="#1ec8ff" /><stop offset="1" stopColor="#1ec8ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pl-b3-${uid}`} gradientUnits="userSpaceOnUse" x1="15" y1="13.5" x2="24" y2="16.5">
          <stop offset="0" stopColor="#2d5fa3" /><stop offset="1" stopColor="#2d5fa3" stopOpacity="0" />
        </linearGradient>
        <filter id={`pl-glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
        <clipPath id={`pl-clip-${uid}`}><path d={TRI} /></clipPath>
      </defs>

      {/* incoming cool collimated beam -> entering the left face */}
      <g filter={`url(#pl-glow-${uid})`} opacity="0.9">
        <line x1="0.5" y1="12.4" x2="8.6" y2="13.1" stroke="#cdd6de" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* refracted dispersion fan -> exiting the right face (arc-cyan -> cool) */}
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
      {/* arc-cyan emissive core — the single emission, at the refraction pivot */}
      <circle ref={coreRef} cx="12" cy="14" r="1.5" fill="#1ec8ff" filter={`url(#pl-glow-${uid})`} />
      {/* chrome bevelled edge — lit, ~1.9 wide */}
      <path d={TRI} fill="none" stroke={`url(#pl-edge-${uid})`} strokeWidth="1.9" strokeLinejoin="round" />
      {/* hairline rim keeps it crisp at masthead size */}
      <path d={TRI} fill="none" stroke="#eef0f3" strokeOpacity="0.22" strokeWidth="0.4" strokeLinejoin="round" />
    </svg>
  );
}
