export const meta = {
  name: 'prebuilt-library-fixround',
  description: 'Fix the MUST-FIX + weakest elements flagged by the user-advocate (empty previews, muddy nav, underlit hero).',
  phases: [{ title: 'Fix' }],
};

// Each entry: the element file + the SPECIFIC defect + the fix direction.
const FIXES = [
  { id: 'slider-morph-through', defect: 'MUST-FIX: hover preview is an empty black skewed frame — liquefy-reveal + displacement-transition both wipe the only panel to empty for much of the time loop.', fix: 'The preview must ALWAYS show a complete, premium slider at EVERY phase of the time loop (never empty). Restructure so a full-coverage panel is ALWAYS visible: LAYER two stacked full-bleed panels (front + back) at slightly different z; keep a continuous, always-visible time motion (e.g. light-sweep across the front panel + a slow parallax drift); if you keep a morph, use a COVERAGE-PRESERVING one (the back panel is full while the front transitions) so the tile is never empty. The "morph-through-3D" identity can read as the front panel subtly displacing while the back panel shows through — but pixels must fill the frame throughout.' },
  { id: 'featuregrid-depth-pop', defect: 'MUST-FIX: empty black hover preview — depth-pop is the ONLY time binding; cards pop from scale 0, so they are absent/tiny for part of the loop.', fix: 'Cards must be FULLY PRESENT at all times in the preview. Make the time-driven ambient a continuous always-visible motion: pointer-tilt-3d (cursor parallax) AND/OR a gentle float, with proximity-rim-glow. Remove depth-pop from the time driver (or replace it). The grid of feature cards should read complete + premium + gently tilting, never popping in from nothing.' },
  { id: 'gallery-masonry-reveal', defect: 'MUST-FIX: empty black hover preview — mask-wipe is the ONLY time binding; tiles are wiped out for part of the loop.', fix: 'The masonry tiles must be FULLY PRESENT at all times. Replace the time-driven mask-wipe with a continuous always-visible motion (gentle parallax + pointer-tilt-3d, or a slow float per tile). The gallery wall should read complete + premium. (The scroll-reveal belongs on a scroll driver in real use, but the time-driven preview must show the settled wall.)' },
  { id: 'slider-distortion-fade', defect: 'RISKY: both time bindings are transitions (wave-distort-in + swirl-warp) that distort the slide away — likely empty/garbled for part of the loop.', fix: 'A full slide must ALWAYS be visible. Keep a stable front slide with a continuous subtle motion (a gentle ripple/shimmer that does NOT wipe coverage, or a light-sweep), and if you keep a distortion, ensure it never reduces coverage to empty. Premium glass-bezel slider, always full-frame.' },
  { id: 'showcase-exploded', defect: 'RISKY: shatter-assemble loops explode->assemble, so the product is scattered/exploded for ~half the loop.', fix: 'For the preview, the product must read as a COMPLETE assembled showcase most of the time. Make the dominant time motion a continuous turntable spin (keep it) on the ASSEMBLED product; if you keep the exploded effect, it should be a small periodic separation that reassembles quickly and never fully scatters off-frame — or move the dramatic explode to an event/hover. Premium assembled product on a turntable.' },
  { id: 'hero-particle-emerge', defect: 'RISKY: particle-assemble loops assemble->scattered, so the mark is dispersed for part of the loop; text-mask-reveal hides text part of the loop.', fix: 'The hero MARK (the central obsidian/brass form) must be FULLY PRESENT + premium at all times. Keep a continuous always-visible motion on the mark (float + a brushed-brass ring spin/shimmer). The particle layer should be an ambient drift AROUND the present mark (not assemble-from-nothing on the time loop). Headline should stay legible (use a continuous text glow/gradient sweep rather than a mask that hides it).' },
  { id: 'carousel-coverflow-depth', defect: 'RISKY: depth-pop is the ONLY time binding; the focus card may pop from 0.', fix: 'All coverflow cards must be FULLY PRESENT at all times. Make the time-driven ambient a continuous scroll-orbit-scrub (the cards orbit through focus) — which it should already have; ensure depth-pop is NOT leaving the focus card absent. The coverflow should read complete + premium, cards always visible, center card in focus.' },
  { id: 'nav-glass-dock', defect: 'MUST-FIX: renders as a muddy brown lump with illegible nav labels.', fix: 'Make the dock read CLEAN + PREMIUM + LEGIBLE: reduce the frosted-glass muddiness (lower roughness ~0.1, higher transmission ~0.9, thin thickness, clearcoat 1 so the pills read as clear ice-glass not brown mud); ensure the MSDF nav labels are high-contrast (bright fill, adequate fontSize ~0.3) and sit IN FRONT of the glass pills (z offset). Brass/ice palette, no brown. The macOS-dock magnetic magnification stays.' },
  { id: 'hero-photoreal-monolith', defect: 'FLAG (featured seed): the hero monolith is underlit/dark.', fix: 'Brighten so the centerpiece reads premium: raise the material envMapIntensity + add a subtle emissive rim or raise metalness/clearcoat so it catches light; consider a brighter iridescence. Set sceneLighting to a stronger key/env so the monolith is well-lit, not a dark sphere. Keep the float + headline reveal. It is a FEATURED hero — it must look stunning.' },
];

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['id', 'changed', 'primitivesUsed', 'ok'],
  properties: {
    id: { type: 'string' }, changed: { type: 'boolean' },
    primitivesUsed: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' }, ok: { type: 'boolean' },
  },
};

function prompt(e) {
  return `Fix ONE prebuilt-library element flagged by a user-advocate. Working dir: /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing. Model claude-opus-4-8.

FILE: src/lib/editor/elements/catalog/${e.id}.ts (edit IN PLACE; keep the self-register + default-export pattern + the ElementClusterDefinition contract).

DEFECT (from real-GPU advocate review): ${e.defect}
FIX DIRECTION: ${e.fix}

CONTEXT YOU CAN READ: the captured frames notes/verification/prebuilt-library/phase4/desktop/${e.id}-frozen.png and ${e.id}-play2.png (look at them — see the defect). The contract notes/PREBUILT-LIBRARY-CONTRACT.md. The palette + recipes in notes/PREBUILT-LIBRARY-CATALOG-PLAN.md.

THE OVERRIDING RULE: the hover preview (a ~4:3 tile, frozen until hover then plays a time loop of loopSeconds) must show a COMPLETE, PREMIUM, photorealistic element at EVERY phase — it must NEVER go empty/black/scattered/wiped. The cluster rig plays time-driven animationBindings on a loop and does NOT drive scroll/pointer in the preview, so:
  - Reveal/transition primitives on driver:'time' (displacement-transition, liquefy-reveal, swirl-warp, wave-distort-in, mask-wipe, depth-pop, scale-pop, particle-assemble, shatter-assemble, text-mask-reveal, etc.) WILL leave the element absent for part of the loop → DO NOT use them as the dominant/only time motion.
  - Use CONTINUOUS, always-visible time motions instead: float, spin, light-sweep, gold-glint, shimmer, metallic-sheen, dispersion, pointer-tilt-3d (steady when frozen), parallax-layers, orbit-rings, liquid-metal-flow, godray, brushed-metal, frosted-glass, etc. Verify any primitive name exists: grep -rl "name: '<p>'" src/lib/prism/animatable/primitives/.
  - You MAY layer/compose members so coverage is always full (e.g. two stacked panels).
  - Keep premium PBR materials (transmission glass / brushed-or-polished metal / iridescence) + receivesLighting:true + a sensible sceneLighting. Observatory Brass palette (brass/gold + ice/steel + charcoal). NO purple, NO brown mud. MSDF text legible (INV-11).
  - You may raise frozenPhase if it helps land a complete still, but the PLAYING loop must also stay complete throughout.

Do NOT edit any other file (no barrel — it's already wired; tsc stays at baseline 9). Keep the element id/label/category. After editing, re-read your file to confirm it's type-correct against ElementClusterDefinition and every primitive name is real.

RETURN (final message, schema JSON): id, changed (true), primitivesUsed (the real names now bound), summary (one line: what you changed so the preview always shows a complete premium element), ok.`;
}

phase('Fix');
log(`Fix-round on ${FIXES.length} advocate-flagged elements…`);
const results = await parallel(
  FIXES.map((e) => () => agent(prompt(e), { label: `fix:${e.id}`, phase: 'Fix', schema: SCHEMA, agentType: 'general-purpose' })),
);
return { fixed: results.filter(Boolean).map((r) => ({ id: r.id, ok: r.ok, prims: r.primitivesUsed, summary: r.summary })) };
