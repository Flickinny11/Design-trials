export const meta = {
  name: 'prebuilt-library-phase2-catalog',
  description: 'Author the comprehensive premium element catalog (§13) — one subagent per element, against the frozen contract.',
  phases: [
    { title: 'Author', detail: 'one ElementClusterDefinition per element' },
  ],
};

// The roster. Each element → one self-registering catalog file. The 2 seeds
// (carousel-photoreal-ring, hero-photoreal-monolith) already exist; these are
// the NEW elements. template: which seed to copy ('hero' = centerpiece+text,
// 'array' = repeated members like carousel-photoreal-ring).
const ROSTER = [
  // CAROUSELS
  { id: 'carousel-coverflow-depth', cat: 'carousel', label: 'Coverflow Depth Carousel', tmpl: 'array', concept: 'a curved row of cards, center card in focus, neighbors angled + depth-blurred — Apple Coverflow in real 3D', bind: 'scroll-orbit-scrub or pointer-orbit; cards depth-pop', tier: 'T1' },
  { id: 'carousel-cylinder-billboard', cat: 'carousel', label: 'Cylinder Billboard Carousel', tmpl: 'array', concept: 'panels wrapped around a slowly rotating cylinder, like a 3D rotating billboard', bind: 'cylinder-unroll + spin', tier: 'T1' },
  // WHEELS
  { id: 'wheel-radial-menu', cat: 'wheel', label: 'Radial Menu Wheel', tmpl: 'array', concept: 'icon/label spokes around a hub that snap to the nearest segment on interaction', bind: 'pointer-orbit + magnet-snap', tier: 'T1' },
  { id: 'wheel-fortune-spinner', cat: 'wheel', label: 'Fortune Spinner Wheel', tmpl: 'array', concept: 'a segmented disc that spins and settles with a satisfying overshoot', bind: 'spin + pendulum-settle', tier: 'T1' },
  // SLIDERS
  { id: 'slider-morph-through', cat: 'slider', label: 'Morph-Through Slider', tmpl: 'array', concept: 'THE Slider-Revolution killer — full-bleed panels that morph THROUGH 3D (displacement/liquefy) between slides', bind: 'displacement-transition or liquefy-reveal', tier: 'T2' },
  { id: 'slider-depth-parallax', cat: 'slider', label: 'Depth Parallax Slider', tmpl: 'array', concept: 'layered slides with foreground/midground/background parallax depth', bind: 'parallax-layers + scroll-depth-dolly', tier: 'T1' },
  { id: 'slider-distortion-fade', cat: 'slider', label: 'Distortion Fade Slider', tmpl: 'array', concept: 'slides crossfade through a liquid swirl/ripple distortion', bind: 'swirl-warp or wave-distort-in', tier: 'T2' },
  // HEROES
  { id: 'hero-liquid-metal', cat: 'hero', label: 'Liquid Metal Hero', tmpl: 'hero', concept: 'a molten chrome centerpiece (flowing liquid metal) behind a kinetic headline', bind: 'liquid-metal-flow + text-fade-up-each', tier: 'T2' },
  { id: 'hero-glass-prism', cat: 'hero', label: 'Glass Prism Hero', tmpl: 'hero', concept: 'a dispersive cut-glass prism splitting light, godrays, with a crisp headline', bind: 'dispersion or iridescent-glass + godray + split-3d', tier: 'T2' },
  { id: 'hero-particle-emerge', cat: 'hero', label: 'Particle Emerge Hero', tmpl: 'hero', concept: 'a mark/logo that assembles from a particle cloud as the headline reveals', bind: 'particle-assemble + text-mask-reveal', tier: 'T2' },
  // BANNERS
  { id: 'banner-silk-flag', cat: 'banner', label: 'Silk Flag Banner', tmpl: 'hero', concept: 'a silk banner rippling in wind, headline across it', bind: 'flag-wind-sim or flag-wave + text', tier: 'T1' },
  { id: 'banner-light-sweep', cat: 'banner', label: 'Light Sweep Banner', tmpl: 'hero', concept: 'a brushed-metal plate with a sweeping specular highlight + headline', bind: 'light-sweep + metallic-sheen', tier: 'T1' },
  { id: 'banner-ticker-3d', cat: 'banner', label: '3D Ticker Banner', tmpl: 'array', concept: 'an extruded 3D ticker strip scrolling repeating words', bind: 'scroll-marquee + text-extrude', tier: 'T1' },
  // GALLERIES
  { id: 'gallery-depth-wall', cat: 'gallery', label: 'Depth Wall Gallery', tmpl: 'array', concept: 'a grid wall of framed panels that tilt with the cursor, parallax depth', bind: 'pointer-tilt-3d + parallax', tier: 'T1' },
  { id: 'gallery-masonry-reveal', cat: 'gallery', label: 'Masonry Reveal Gallery', tmpl: 'array', concept: 'a masonry grid whose tiles stagger-rise + wipe in on scroll', bind: 'scroll-stagger-rise + mask-wipe', tier: 'T1' },
  // CARD-STACK
  { id: 'cardstack-swipe-deck', cat: 'card-stack', label: 'Swipe Deck', tmpl: 'array', concept: 'a physics deck of cards you fling away (Tinder-style) in real 3D', bind: 'throw-physics or drag-elastic-warp', tier: 'T1' },
  { id: 'cardstack-fan-spread', cat: 'card-stack', label: 'Fan Spread Stack', tmpl: 'array', concept: 'a deck that fans open like a hand of cards on hover', bind: 'card-fold + hover-lift', tier: 'T1' },
  // NAVIGATION
  { id: 'nav-glass-dock', cat: 'navigation', label: 'Glass Dock Nav', tmpl: 'array', concept: 'a row of frosted-glass nav pills that magnify + lift toward the cursor (macOS dock)', bind: 'magnetic + hover-lift + frosted-glass', tier: 'T1' },
  { id: 'nav-orbital-ring', cat: 'navigation', label: 'Orbital Ring Nav', tmpl: 'array', concept: 'nav items riding an orbital ring you rotate to bring an item front', bind: 'pointer-orbit', tier: 'T1' },
  // SHOWCASE
  { id: 'showcase-turntable', cat: 'showcase', label: 'Turntable Showcase', tmpl: 'hero', concept: 'a product on a brushed-metal turntable under a moving spotlight', bind: 'spin + spotlight-follow + brushed-metal', tier: 'T2' },
  { id: 'showcase-exploded', cat: 'showcase', label: 'Exploded View Showcase', tmpl: 'array', concept: 'product parts that explode apart and reassemble', bind: 'shatter-assemble or tiles-assemble', tier: 'T1' },
  // MARQUEE
  { id: 'marquee-ribbon-flow', cat: 'marquee', label: 'Ribbon Flow Marquee', tmpl: 'array', concept: 'a flowing 3D ribbon of words snaking across the scene', bind: 'flow-ribbon + text', tier: 'T1' },
  // FEATURE-GRID
  { id: 'featuregrid-tilt-cards', cat: 'feature-grid', label: 'Tilt Card Feature Grid', tmpl: 'array', concept: 'a grid of feature cards that tilt in 3D toward the cursor with a rim-glow', bind: 'pointer-tilt-3d + proximity-rim-glow', tier: 'T1' },
  { id: 'featuregrid-depth-pop', cat: 'feature-grid', label: 'Depth Pop Feature Grid', tmpl: 'array', concept: 'feature cards that pop forward in depth as they enter view', bind: 'depth-pop + scroll-stagger-rise', tier: 'T1' },
  // TESTIMONIAL
  { id: 'testimonial-orbit-quotes', cat: 'testimonial', label: 'Orbit Quotes', tmpl: 'array', concept: 'avatar discs orbiting a central quote panel', bind: 'orbit-rings + text', tier: 'T1' },
  { id: 'testimonial-float-glass', cat: 'testimonial', label: 'Floating Glass Quotes', tmpl: 'array', concept: 'frosted-glass quote cards gently floating at varied depths', bind: 'float + frosted-glass', tier: 'T1' },
  // PRICING
  { id: 'pricing-pillars-3d', cat: 'pricing', label: '3D Pricing Pillars', tmpl: 'array', concept: 'three 3D pillars (the middle tallest/featured, gold-accented) with rolling prices', bind: 'scale-pop + gold-glint + text-counter-roll', tier: 'T2' },
  { id: 'pricing-glass-tiers', cat: 'pricing', label: 'Glass Pricing Tiers', tmpl: 'array', concept: 'glass tier cards with a light sweep across the featured one', bind: 'bevel-glass + light-sweep', tier: 'T2' },
  // STAT-COUNTER
  { id: 'stats-odometer', cat: 'stat-counter', label: 'Odometer Stats', tmpl: 'array', concept: 'brushed-metal odometer counters that roll up to their value', bind: 'text-counter-roll + brushed-metal', tier: 'T1' },
  { id: 'stats-ring-progress', cat: 'stat-counter', label: 'Ring Progress Stats', tmpl: 'array', concept: 'circular progress rings that fill to their percentage', bind: 'scroll-progress-fill', tier: 'T1' },
  // CTA
  { id: 'cta-magnetic-pedestal', cat: 'cta', label: 'Magnetic CTA Pedestal', tmpl: 'hero', concept: 'a glowing CTA button on a lit pedestal that magnetically pulls the cursor + charges on press', bind: 'magnetic + charge-release + neon-edge-pulse', tier: 'T2' },
  { id: 'cta-glass-banner', cat: 'cta', label: 'Glass CTA Banner', tmpl: 'hero', concept: 'a wide glass CTA bar with a light sweep and a crisp headline + button', bind: 'bevel-glass + light-sweep + text', tier: 'T1' },
  // LOGO-CLOUD
  { id: 'logocloud-orbital', cat: 'logo-cloud', label: 'Orbital Logo Cloud', tmpl: 'array', concept: 'partner logos orbiting in a 3D cloud', bind: 'orbit-rings', tier: 'T1' },
  { id: 'logocloud-constellation', cat: 'logo-cloud', label: 'Constellation Logo Cloud', tmpl: 'array', concept: 'logos linked as a slowly drifting constellation with parallax', bind: 'constellation-net + parallax-layers', tier: 'T1' },
];

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'file', 'memberCount', 'primitivesUsed', 'designRefs', 'ok'],
  properties: {
    id: { type: 'string' },
    file: { type: 'string' },
    memberCount: { type: 'integer' },
    primitivesUsed: { type: 'array', items: { type: 'string' } },
    designRefs: { type: 'array', items: { type: 'string' } },
    selfRegisters: { type: 'boolean' },
    ok: { type: 'boolean' },
    notes: { type: 'string' },
  },
};

function promptFor(e) {
  return `Author ONE premium prebuilt-library element definition. Working dir: /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing. Model claude-opus-4-8.

READ FIRST: notes/PREBUILT-LIBRARY-CONTRACT.md (the FROZEN contract — obey types exactly) + notes/PREBUILT-LIBRARY-CATALOG-PLAN.md (palette + checklist) + the seed template src/lib/editor/elements/catalog/${e.tmpl === 'hero' ? 'hero-photoreal-monolith.ts' : 'carousel-photoreal-ring.ts'} (COPY its structure, material recipe, and quality).

ELEMENT TO BUILD:
- id: ${e.id}
- category: ${e.cat}
- label: ${e.label}
- concept (the SR-smashing move — make it STUNNING): ${e.concept}
- suggested integrated animation bindings: ${e.bind}
- full-fidelity tier: ${e.tier} (MUST still read clean at T0 — never broken)

WRITE: src/lib/editor/elements/catalog/${e.id}.ts. Pattern (self-registering, so the barrel only needs a side-effect import):
\`\`\`
import { registerElement } from '../registry';
import type { ElementClusterDefinition } from '../contract';
// (import any schema helper types you reference, e.g. ScenePosition, from '@/lib/prism-graph/types')
const ${camel(e.id)}: ElementClusterDefinition = { id: '${e.id}', label: '${e.label}', category: '${e.cat}', /* caption, description, members[], preview, designRefs[], tier */ };
registerElement(${camel(e.id)});
export default ${camel(e.id)};
\`\`\`

QUALITY BAR (must SMASH Slider Revolution — a senior 3D designer must call it best-in-class):
- 3–8 members. Use meshPrimitive (cube/sphere/cylinder/cone/torus/capsule/plane) + a PREMIUM materialSpec for geometric members. Premium PBR recipes: brushed metal {metalness:0.95, roughness:0.32, envMapIntensity:1.3}; polished chrome {metalness:1, roughness:0.08, clearcoat:1, envMapIntensity:1.6}; glass {transmission:0.92, ior:1.5, dispersion:0.04, clearcoat:1, roughness:0.06, thickness:0.5}; iridescent {iridescence:0.8, iridescenceIOR:1.3, metalness:0.6, roughness:0.25}; obsidian {baseColor:'#15171f', metalness:0.7, roughness:0.18, clearcoat:1}. Palette = Observatory Brass (brass/gold #c9a86a-ish + ice/steel blues + charcoal). NO purple.
- Set receivesLighting:true on lit meshes. Optionally set lightingSpec.tier on members or sceneLighting for the cluster.
- Text members: renderMode:'text' + textSpec {content, fontSize (KEEP MODEST relative to the cluster — ~0.25–0.45 so it frames inside the tile), fontWeight, fill}. Real MSDF (INV-11).
- Each cluster carries ≥1 integrated animationBinding. animationBindings[].primitive MUST be a REAL registry name — VERIFY by: \`grep -rl "name: '<primitive>'" src/lib/prism/animatable/primitives/\`. If your suggested name is missing, pick the closest real one (palette is in the catalog plan). driver: usually 'time' for ambient motion, 'pointer' for cursor-reactive, 'scroll' for scroll-choreo.
- preview.camera: pick distance/polar/azimuth that frames ALL members nicely in a ~4:3 tile (or omit distance to use the rig's auto-fit). frozenPhase ~0.4, loopSeconds 4–8.
- designRefs: 2–5 short strings naming the DESIGN-REFERENCES techniques shown (e.g. 'morph-through-3D transition', 'PBR transmission glass', 'magnetic cursor physics').
- Poses: lay members out in cluster-local space (origin 0,0,0); the instantiator offsets by the drop anchor. Give a real composition (a ring, a row, a stack, a centerpiece+label), not all at the origin.

CONSTRAINTS: editor scope (@/ alias OK). NO new npm dep, NO new renderer, NO purple, NO 'fal' in copy, additive only. Do NOT edit catalog/index.ts (the orchestrator regenerates the barrel). Do NOT run tsc or a dev server. Keep the file self-contained and type-correct against the contract.

VERIFY before returning: re-read your file; confirm every animationBindings primitive name exists (grep); confirm it type-matches ElementClusterDefinition (members have localId/subtype/caption/renderMode/pose/footprint; pose is a full ScenePosition with all 9 fields).

RETURN (final message = structured JSON via the schema): id, file path, memberCount, primitivesUsed (the real registry names you bound), designRefs, selfRegisters (true), ok, notes (one line: the move it shows + any deviation).`;
}

function camel(id) {
  return id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

phase('Author');
log(`Authoring ${ROSTER.length} premium element definitions (one subagent each)…`);

const results = await parallel(
  ROSTER.map((e) => () =>
    agent(promptFor(e), { label: `author:${e.id}`, phase: 'Author', schema: RESULT_SCHEMA, agentType: 'general-purpose' }),
  ),
);

const ok = results.filter(Boolean).filter((r) => r.ok);
const bad = results.filter(Boolean).filter((r) => !r.ok);
log(`Authored ${ok.length}/${ROSTER.length} OK; ${bad.length} flagged.`);

return {
  authored: results.filter(Boolean).map((r) => ({ id: r.id, file: r.file, members: r.memberCount, primitives: r.primitivesUsed, ok: r.ok, notes: r.notes })),
  rosterCount: ROSTER.length,
  okCount: ok.length,
};
