// W-PCP D2/D3 — the compact always-on PCP blocks that ride L1 v2.
//
// L1 v2.1 (W-BAKE-B D0): three measured refinements land here additively,
// per the W-PCP report §9 — (1) a numeric white-subject key-light exposure
// ceiling in the design doctrine; (2) a gsap NAMED-import rule and (3) a
// ctx.THREE-is-NodeMaterial-free rule, both in an IMPORT DISCIPLINE block on
// the dependency gate. All three carry committed probe evidence and are the
// dominant residual crash classes the W-PCP probe surfaced. Additive only:
// V1 is untouched and the L2 template is byte-frozen.
//
// These are the DISTILLATIONS. The full doctrine lives in
// docs/prism/pcp/DESIGN-PLAYBOOK.md / DEPENDENCY-CATALOG.md /
// ASSET-SERVICES.md; deep per-class guides retrieve from the skill registry
// (skill-registry.ts). Byte-stable constants (OD7): nothing here varies per
// node, per build, or per call.

/** Design doctrine core — DL1–DL16 operationalized + W-DG1 numeric doctrine
 *  + anti-slop MUST-FIX triggers. Sources: PRISM-SHELL-DESIGN-LAW-2026-07-03,
 *  design-grammar/families (14 grounded families), numeric ranges proven on
 *  shipped W9A/W-TPL/W-BG/W-PHOTO nodes. */
export const DESIGN_DOCTRINE_L1_BLOCK: string = [
  'DESIGN DOCTRINE (your render is judged 0-100 against the visualSpec + these laws; every violation is a MUST-FIX):',
  '- STAGE, never void: build a backdrop plane (~7x6 units at z=-2.5) carrying the spec gradientStops as a vertical',
  '  gradient. A flat #000 region >25% of frame = FLAT_VOID defect. Dark-first means designed-for-dark, never empty black.',
  '- ONE brightest element: decide it up front (key-lit subject, emissive core, or accent headline) and grade everything',
  '  else below it. Emissive intensity cap 2.3 (tone mapping clips warm emissives above ~2.5 to orange mush).',
  '- PALETTE: use the spec colors EXACTLY. One accent, on <=10% of the frame. ANY blue the spec did not name is',
  '  DEFAULT_BLUE_DRIFT (automatic MUST-FIX). Text contrast >= 4.5:1 against its local backdrop.',
  '- LIGHT like a product shot: key ~1.0-1.4 at 30-45 deg + rim/back 0.6-1.0 opposite (may carry the accent hue) +',
  '  ambient fill. The scene provides ambient 0.6 + key 1.2 ONLY — add the rim/accent lights node-locally (intensity <=1.5).',
  '  Metal with nothing to reflect renders BLACK: pair metalness>0.5 with a lit backdrop or env source. Uniform',
  '  brightness = DEAD_LIGHTING.',
  '- WHITE-SUBJECT KEY CEILING (W-PCP §9.1): white / high-albedo (>0.7) PBR subjects blow out first. Cap summed direct',
  '  irradiance on the hero — key <=1.2 AND rim <=0.8 (total direct <=2.0); let form read through shadow and roughness,',
  '  not exposure. A white subject rendered as a featureless blown-white silhouette with no visible geometry is a',
  '  BLOWN_WHITE_KEY MUST-FIX.',
  '- MATERIALS (proven PBR ranges): flat cards/panels roughness>=0.5, metalness<=0.55, clearcoat<=0.25 (above = specular',
  '  blowout). Glass: transmission 0.9-1.0, ior 1.4-1.6, thickness>0, PLUS a back rim light and emissive core or it',
  '  vanishes on the dark stage. Interactive elements are extruded 3D objects with bevel + PBR, never flat rects.',
  '- COMPOSITION: fill the hub frame (x in [-3.5,3.5], y in [-3,2.5] at fov 50, camera z=10). Hero subject 55-70% of',
  '  frame height; tiny-centered-subject-in-void = SCALE_ERROR. Three depth planes minimum (backdrop / subject /',
  '  foreground accent). Grounded objects get a radial contact-shadow plane (radius 1.1-1.6x subject, opacity 0.4-0.6).',
  '- TYPE: bimodal scale — display sizes for hero/headline, caption sizes for labels, nothing in between. Serif display,',
  '  mono captions/CTAs; ALL-CAPS labels get letterSpacing 0.05-0.12em. ASCII ONLY in rendered text (em-dash, bullets,',
  '  arrows, smart quotes garble in the glyph atlas). Render the spec copy verbatim from the textContent items — never',
  '  invent or hardcode alternate copy.',
  '- MOTION with weight: entrances 0.5-0.9s power2/power3.out with translate <=0.4 units; settle overshoot 1.04->1.0',
  '  over 0.9s power4.out; press scale 0.97 in 120ms; hover tilt <=6 deg over 300ms. LINEAR EASING ON HERO MOTION IS',
  '  FORBIDDEN. Idle = ONE slow transform (orbit 0.1-0.2 rad/s or breathing <=2%). Kill every timeline in cleanup.',
  '- FORBIDDEN SLOP (each = automatic MUST-FIX): purple-gradient-on-dark template wash; all-black button on black stage;',
  '  glassmorphism blur cards; emoji; lorem/invented copy; single unlit plane as the whole node; screensaver multi-axis',
  '  perpetual motion.',
  '- Before returning: checklist the visualSpec — every named color, copy string, material, light, and primitive must be',
  '  visibly present (MISSING_SPEC_ELEMENT is the #1 defect).',
].join('\n');

/** Dependency + asset rules — the deterministic pre-gate distilled.
 *  Source of truth: docs/prism/pcp/DEPENDENCY-CATALOG.md + ASSET-SERVICES.md. */
export const DEPENDENCY_L1_BLOCK: string = [
  'DEPENDENCIES (a deterministic import-scan gate runs BEFORE judging; any import outside the allowlist is an',
  'automatic MUST-FIX and will not resolve at runtime):',
  "- Allowed import sources, exactly: 'three/webgpu' (THREE classes + MeshBasicNodeMaterial/MeshStandardNodeMaterial/",
  "  MeshPhysicalNodeMaterial), 'three/tsl' (shader nodes: uv, vec3, mix, smoothstep, time, uniform, ...), 'gsap',",
  "  '@/primitives', '@/text'. NodeMaterials come from 'three/webgpu' — importing them from 'three/tsl' crashes.",
  "- NEVER import: 'three', 'three/addons/*' (GLTFLoader rides ctx.glbLoader), 'three-msdf-text-webgpu' (ride",
  '  ctx.fontAtlas), react, fetch/network, node builtins.',
  '- Assets are pre-generated and arrive as URLs in config (imageUrl/depthMapUrl/meshUrl) — load them ONLY through the',
  '  ctx loaders. Never generate, fetch, or inline assets in module code.',
  'IMPORT DISCIPLINE (W-PCP §9 — the dominant residual crash class after API spelling; each below crashes at runtime):',
  "- gsap: import the NAMED binding — import { gsap } from 'gsap'. The default form import gsap from 'gsap' reads undefined",
  '  under the module interop and throws at the first gsap.timeline()/gsap.to() call. Always destructure the named export.',
  '- ctx.THREE is the PLAIN three namespace and has NO NodeMaterials. MeshBasicNodeMaterial / MeshStandardNodeMaterial /',
  '  MeshPhysicalNodeMaterial exist ONLY on the three/webgpu import — new ctx.THREE.MeshStandardNodeMaterial() is undefined',
  '  and throws. Read geometry / vector / Group / Mesh classes off ctx.THREE; import every *NodeMaterial from three/webgpu.',
  "- The ONLY import lines that resolve are a subset of: import { ... } from 'three/webgpu'; import { ... } from 'three/tsl';",
  "  import { gsap } from 'gsap'; import { ... } from '@/primitives'; import { ... } from '@/text'. Any other module path",
  '  (three, three/addons/*, three-msdf-text-webgpu, react, a node builtin, a CDN URL) fails the gate AND crashes at runtime.',
].join('\n');
