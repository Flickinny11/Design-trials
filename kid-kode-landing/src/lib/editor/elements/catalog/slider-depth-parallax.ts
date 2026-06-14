// slider-depth-parallax — a layered, depth-staged 3D slider (§13 prebuilt
// library, category 'slider'). Where Slider Revolution fakes parallax with 2D
// CSS layers translating at different rates, this stages the slide across REAL
// z-depth: a recessed background slab, a brushed-brass midground frame, a
// transmissive glass focal slide floating forward, a polished-chrome accent
// rail, and two MSDF text members (headline + kicker) layered nearest the
// viewer. Each member is assigned a real `depthLayer` so the depth compositor
// stacks them correctly, and the composition reads as physical depth — not a
// flat stack — from the very first frame.
//
// INTEGRATED animation (two real registry primitives, both verified):
//   • foreground glass slide — `scroll-depth-dolly` (scroll category, verified
//     registered): the focal slide dollies through depth as the page scrolls,
//     rushing toward (and slightly past) the viewer through the midrange with a
//     coupled perspective scale. This is the depth-dolly that SMASHES the flat
//     2D crossfade.
//   • headline — `parallax-layers` (pointer category, verified registered):
//     cursor movement shifts the headline's depth layers opposite the pointer
//     for a live 3D parallax that tracks the visitor's gaze.
//
// Photorealism is procedural PBR + studio IBL (free): glass transmission +
// dispersion + clearcoat on the focal slide, brushed brass on the frame,
// polished chrome on the accent rail, smoked charcoal on the backdrop. No
// imagery needed — no `sourceAsset`.
//
// Tier: T1 full-fidelity (dynamic key/fill/rim + soft shadows make the glass
// and brass sing). Clean T0 fallback (INV-9): at T0 the glass reads as a tinted
// translucent panel and the brass/chrome as lit metals under IBL + ambient —
// still a legible, layered, depth-staged slider, never broken.

import { registerElement } from '../registry';
import type { ElementClusterDefinition } from '../contract';

// ── Palette: Observatory Brass — warm brass/gold + ice/steel blues + charcoal.
// NEVER purple. Card data colors are graph data, not chrome.
const BRASS = '#c9a86a'; // warm brushed brass (frame)
const CHROME = '#cfd6dd'; // polished chrome (accent rail)
const GLASS_TINT = '#a9c6d6'; // ice-blue glass focal slide
const CHARCOAL = '#181b22'; // smoked charcoal backdrop
const STEEL = '#2a313c'; // cool steel midground inlay

// Local depth staging (cluster origin at 0,0,0; the instantiator offsets by the
// drop anchor). Negative z = away from the viewer; positive z = toward.
const Z_BACKDROP = -1.6;
const Z_MIDFRAME = -0.55;
const Z_RAIL = -0.15;
const Z_GLASS = 0.35;
const Z_TEXT = 0.95;

const sliderDepthParallax: ElementClusterDefinition = {
  id: 'slider-depth-parallax',
  label: 'Depth Parallax Slider',
  category: 'slider',
  caption: 'Layered slides staged across real 3D depth',
  description:
    'A slide staged through real z-depth — backdrop, brass frame, glass focal panel — that dollies and parallaxes.',
  members: [
    // ── Backdrop — a large smoked-charcoal slab anchoring the deepest layer.
    // Opted into lighting so it catches a soft gradient and gives the glass +
    // metals something to reflect. depthLayer:'background'.
    {
      localId: 'backdrop',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Slider backdrop',
      renderMode: 'mesh',
      pose: {
        x: 0,
        y: 0,
        z: Z_BACKDROP,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 5.2, height: 3.0 },
      meshPrimitive: {
        kind: 'cube',
        params: { width: 5.2, height: 3.0, depth: 0.12 },
      },
      materialSpec: {
        // Wide landscape hero photo on the deepest slide panel (the parallax
        // backdrop the visitor sees behind the glass focal slide). White base so
        // the map reads at full color; glossy print/poster finish.
        baseColor: '#ffffff',
        baseColorMapUrl: '/prism-mock/library-content/landscape-peak.png',
        metalness: 0.0,
        roughness: 0.42,
        clearcoat: 0.6,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.0,
      },
      receivesLighting: true,
      depthLayer: 'background',
    },
    // ── Midground frame — a brushed-brass beveled panel sitting between the
    // backdrop and the focal slide. The classic "premium PBR brushed metal"
    // recipe. depthLayer:'midground'.
    {
      localId: 'frame',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Brass frame',
      renderMode: 'mesh',
      pose: {
        x: 0,
        y: 0,
        z: Z_MIDFRAME,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 3.7, height: 2.25 },
      meshPrimitive: {
        kind: 'cube',
        params: { width: 3.7, height: 2.25, depth: 0.16 },
      },
      materialSpec: {
        baseColor: BRASS,
        metalness: 0.95,
        roughness: 0.32,
        clearcoat: 0.5,
        clearcoatRoughness: 0.25,
        envMapIntensity: 1.3,
      },
      receivesLighting: true,
      depthLayer: 'midground',
    },
    // ── Steel inlay — a cool-steel recessed plate just in front of the brass
    // frame, deepening the layered look (a frame-within-frame). depthLayer:
    // 'midground' (shares the mid band, sits a hair forward).
    {
      localId: 'inlay',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Steel inlay',
      renderMode: 'mesh',
      pose: {
        x: 0,
        y: 0,
        z: Z_MIDFRAME + 0.18,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 3.2, height: 1.85 },
      meshPrimitive: {
        kind: 'cube',
        params: { width: 3.2, height: 1.85, depth: 0.08 },
      },
      materialSpec: {
        // Second wide landscape hero photo on the inset midground slide plate —
        // a DIFFERENT image from the backdrop so the staged depth reads as a
        // real layered slideshow, not one flat repeated panel. Glossy print look.
        baseColor: '#ffffff',
        baseColorMapUrl: '/prism-mock/library-content/arch-warm.png',
        metalness: 0.0,
        roughness: 0.42,
        clearcoat: 0.6,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.0,
      },
      receivesLighting: true,
      depthLayer: 'midground',
    },
    // ── Accent rail — a thin polished-chrome bar across the lower third,
    // bridging the mid and focal layers with a bright specular line.
    // depthLayer:'content'.
    {
      localId: 'rail',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Chrome rail',
      renderMode: 'mesh',
      pose: {
        x: 0,
        y: -0.78,
        z: Z_RAIL,
        rotationX: 0,
        rotationY: 0,
        rotationZ: Math.PI / 2, // lay the cylinder horizontal
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 2.9, height: 0.12 },
      meshPrimitive: {
        kind: 'cylinder',
        params: { radius: 0.05, height: 2.9, segments: 48 },
      },
      materialSpec: {
        baseColor: CHROME,
        metalness: 1.0,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.6,
      },
      receivesLighting: true,
      depthLayer: 'content',
    },
    // ── Focal glass slide — the transmissive ice-blue panel floating forward,
    // the slide the visitor's eye lands on. Premium glass recipe (transmission
    // + ior + dispersion + clearcoat). depthLayer:'foreground-FX'.
    // INTEGRATED animation: `scroll-depth-dolly` — scroll pushes the slide
    // through depth toward (and slightly past) the viewer.
    {
      localId: 'glass-slide',
      subtype: 'card',
      serviceTag: 'decor',
      caption: 'Glass focal slide',
      renderMode: 'mesh',
      pose: {
        x: 0,
        y: 0.05,
        z: Z_GLASS,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 2.6, height: 1.55 },
      meshPrimitive: {
        kind: 'cube',
        params: { width: 2.6, height: 1.55, depth: 0.1 },
      },
      materialSpec: {
        baseColor: GLASS_TINT,
        metalness: 0.0,
        roughness: 0.06,
        transmission: 0.92,
        ior: 1.5,
        dispersion: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        thickness: 0.5,
        envMapIntensity: 1.4,
      },
      receivesLighting: true,
      depthLayer: 'foreground-FX',
      animationBindings: [
        {
          id: 'ab-slider-glass-dolly',
          primitive: 'scroll-depth-dolly',
          driver: 'scroll',
          params: { depth: 2.2, passBy: 0.5, fadeEnds: true },
          order: 0,
        },
      ],
    },
    // ── Headline — REAL MSDF text (INV-11), nearest the viewer. Modest font
    // size so it frames inside the focal slide. INTEGRATED animation:
    // `parallax-layers` — pointer movement shifts the headline's depth layers
    // for a live 3D parallax that tracks the cursor.
    {
      localId: 'headline',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Slider headline',
      renderMode: 'text',
      pose: {
        x: 0,
        y: 0.22,
        z: Z_TEXT,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 2.4, height: 0.42 },
      textSpec: {
        content: 'IN DEPTH',
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 0.4,
        align: 'center',
        letterSpacing: 0.05,
        fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
        decompose: 'glyph',
      },
      depthLayer: 'foreground-FX',
      animationBindings: [
        {
          id: 'ab-slider-headline-parallax',
          primitive: 'parallax-layers',
          driver: 'pointer',
          params: { strength: 0.4, depthSpread: 1.1, invert: false },
          order: 0,
        },
      ],
    },
    // ── Kicker — a small MSDF sub-label beneath the headline, keeping the text
    // hierarchy tight inside the tile. depthLayer:'foreground-FX'.
    {
      localId: 'kicker',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Slider kicker',
      renderMode: 'text',
      pose: {
        x: 0,
        y: -0.18,
        z: Z_TEXT,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 2.2, height: 0.24 },
      textSpec: {
        content: 'LAYERED IN 3D',
        fontFamily: 'Inter',
        fontWeight: 500,
        fontSize: 0.26,
        align: 'center',
        letterSpacing: 0.16,
        fill: { kind: 'solid', color: '#cfd6dd' },
        decompose: 'glyph',
      },
      depthLayer: 'foreground-FX',
    },
  ],
  preview: {
    // Three-quarter framing so the z-staging reads as real depth (the layers
    // visibly step back). Slightly above eye level.
    camera: { distance: 6.4, polar: Math.PI / 2.3, azimuth: Math.PI * 0.12 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm-key studio look at place time (additive; never forces a hub-wide
  // change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.3,
    ambientIntensity: 0.28,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'multi-layer depth parallax staging',
    'scroll depth-dolly choreography',
    'magnetic cursor parallax physics',
    'PBR transmission glass',
    'brushed-metal PBR frame',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(sliderDepthParallax);
export default sliderDepthParallax;
