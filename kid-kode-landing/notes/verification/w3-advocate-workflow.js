export const meta = {
  name: 'w3-distortion-advocate',
  description: 'Fresh-context user-advocate review of the 13 W3 DISTORTION/DISPLACEMENT primitives against captured DPR-2 evidence',
  phases: [{ title: 'Advocate', detail: 'one user-advocate per tile, structured verdict' }],
};

// Each tile: [name, claim, groundTruthSibling]
const TILES = [
  ['hover-liquid-distort', 'The surface goes LIQUID under the cursor — slow viscous ripples well out from the touch point and settle like honey when the pointer leaves. CRITICAL: the card’s OWN texture/header/rows are preserved and ride the well; it must NEVER become a blank/featureless deformed slab.', 'ripple-displace'],
  ['drag-elastic-warp', 'Grab-and-drag stretches the surface toward the cursor like elastic skin pinned at its corners, snapping back with a wobble on release. The card texture/chrome stays intact through the stretch.', 'swirl-warp'],
  ['pointer-glitch-split', 'The cursor slices the surface into glitch bands — RGB-split slivers shearing out of alignment around the pointer, snapping clean when it leaves. Card content stays legible between/under the bands.', 'datamosh'],
  ['heat-haze-refract', 'A column of heat shimmer rises across the surface — the image wavering through refracting air, like asphalt in August. Content is refracted, never replaced.', 'ripple-displace'],
  ['lens-bulge', 'A magnifying bulge swells under the cursor — the surface domes out optically, content stretching at the rim like glass over paper. Texture preserved through the bulge.', 'liquefy-reveal'],
  ['pointer-wake-wave', 'The cursor carves a wake across the surface — a V of cresting ripples trailing its path, fading like water behind a boat. Card preserved.', 'wave-distort-in'],
  ['pixel-sort-sweep', 'A sorting wave sweeps the surface — content smearing into directional streaks along the wavefront, resolving crisp behind it (glitch-art pixel-sort). The card resolves legible behind the sweep.', 'datamosh'],
  ['hover-displacement-map', 'Hover pours a hidden relief into the surface — a procedural displacement map embossing the content, deepening as the cursor nears. Content preserved, just embossed.', 'ripple-displace'],
  ['pointer-twist-warp', 'The cursor wrings the surface — a local twist vortex rotating the content around the pointer, untwisting smoothly as it leaves. Texture preserved through the twist.', 'swirl-warp'],
  ['click-shockwave', 'Engage and a shockwave detonates from the center — one crisp pressure ring racing outward, kicking the surface and its chrome as it passes.', 'ripple-displace'],
  ['crt-warp', 'The surface becomes an old CRT — barrel-curved glass, drifting scanlines, and a slow rolling flicker band — retro phosphor warmth over the REAL content (content still readable through the curve).', 'datamosh'],
  ['flow-warp-idle', 'The surface breathes in a slow current — content drifting along a gentle flow field and back, like a reflection on calm water. Subtle, premium, content preserved.', 'wave-distort-in'],
  ['pointer-loupe', 'A magnifier loupe follows the cursor, optically zooming the content beneath it like a glass lens — a crisp magnified inset that tracks the pointer; surrounding card preserved.', 'lens-bulge'],
];

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['feature', 'claim', 'groundTruthSibling', 'state', 'rubric', 'mustFix', 'flags', 'net', 'gate'],
  properties: {
    feature: { type: 'string' },
    claim: { type: 'string' },
    groundTruthSibling: { type: 'string' },
    state: { type: 'string' },
    rubric: {
      type: 'object',
      additionalProperties: false,
      required: ['q1_defects', 'q2_reads_as', 'q3_discoverable', 'q4_responsive', 'q5_net'],
      properties: {
        q1_defects: { type: 'object', additionalProperties: false, required: ['answer', 'evidence'], properties: { answer: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } } } },
        q2_reads_as: { type: 'object', additionalProperties: false, required: ['answer', 'evidence'], properties: { answer: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } } } },
        q3_discoverable: { type: 'object', additionalProperties: false, required: ['answer', 'evidence'], properties: { answer: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } } } },
        q4_responsive: { type: 'object', additionalProperties: false, required: ['answer', 'evidence'], properties: { answer: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } } } },
        q5_net: { type: 'object', additionalProperties: false, required: ['answer', 'evidence'], properties: { answer: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } } } },
      },
    },
    mustFix: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['issue', 'evidence'], properties: { issue: { type: 'string' }, evidence: { type: 'string' } } } },
    flags: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['note', 'evidence'], properties: { note: { type: 'string' }, evidence: { type: 'string' } } } },
    net: { type: 'string', enum: ['PLEASED', 'INDIFFERENT', 'ANNOYED'] },
    gate: { type: 'string', enum: ['PASS', 'PASS-WITH-FLAGS', 'BLOCKED', 'INVALID'] },
  },
};

phase('Advocate');

const verdicts = await parallel(TILES.map(([name, claim, sibling]) => () =>
  agent(
    `You are the USER-ADVOCATE capstone reviewer judging a single Prism animation primitive as a discerning, NON-TECHNICAL user would — looking ONLY at the captured evidence frames (real Metal-GPU WebGPU renders at devicePixelRatio 2), never the DOM or source logic.

FEATURE: ${name}
CLAIM (what it should look/feel like): ${claim}
GROUND-TRUTH SIBLING (an existing premium primitive for calibration): ${sibling}
STATE: after

EVIDENCE DIR (read every PNG here with the Read tool — it renders images visually):
  notes/verification/useradvocate-sixtile/${name}/after/
Frames present: idle.png (pointer disengaged / t=0 — must show the CLEAN, fully legible card), play-1/2/3.png (mid-animation phases), control-<id>-low/mid/high.png (each ControlSchema knob swept). Also read metrics.json in that dir for measured deltas + which controls were swept.

You may use Bash (cd into the repo: /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing) to list the dir and to run zoom crops if useful, e.g. via the sharp CLI is NOT available — instead Read the PNGs directly at full size and judge sharpness from the native-resolution image.

THE BAR (Logan’s standard, from notes/LOGAN-INBOX.md): premium 4K-motion-graphics quality that visibly OUTCLASSES Slider-Revolution-class DOM effects. Judge at DPR-2. Specifically for this DISTORTION/DISPLACEMENT wave:
  1. TEXTURE-PRESERVING DISCIPLINE (the load-bearing W3 invariant): these primitives are 'mountable' — they must overlay the subject’s OWN look (its texture, brass header, grey rows, accent dot) and distort THAT. A featureless tan/blue/white deformed SLAB with no card content = the #1 defect class (it killed sibling tiles cylinder-unroll/genie-suck/scroll-fold-scrub earlier). If you see the effect applied to a blank placeholder rather than the real card, that is a mustFix.
  2. The effect must clearly READ AS ITS NAME/claim (a liquid well, an elastic stretch, RGB glitch bands, heat shimmer, a lens bulge, a wake, a pixel-sort sweep, an emboss, a twist vortex, a shockwave ring, a CRT curve, a flow drift, a loupe magnifier).
  3. SHARPNESS: the preserved card content must be tack-sharp at native resolution (no blur/softness that reads as low-fidelity).
  4. CONTROLS LIVE: the control-*-low vs -high frames must visibly differ (a dead control = mustFix or flag per its severity).
  5. ANTI-SLop: nothing that reads as AI-built, flat, or accidental.

Compare idle.png (clean card) against the play/control frames to confirm BOTH that the real card look is preserved AND that a premium distortion is visibly happening.

Answer the 5-question rubric. EVERY answer’s evidence array MUST cite real frame filenames from the evidence dir (e.g. "${name}/after/play-2.png") or a measured "metrics: …" citation — a verdict without cited evidence is INVALID.
  q1_defects: any defects (placeholder slab? blur? clipping? broken frame? dead control?)
  q2_reads_as: does it read as the claim, at premium quality?
  q3_discoverable: is the effect obvious / does the idle state invite it?
  q4_responsive: do the controls visibly change the look (cite low vs high frames)?
  q5_net: overall — PLEASED / INDIFFERENT / ANNOYED.

Then set:
  net: PLEASED | INDIFFERENT | ANNOYED
  mustFix: array of {issue, evidence} — blocking defects (empty if none). If net=ANNOYED, mustFix MUST be non-empty.
  flags: array of {note, evidence} — non-blocking taste notes.
  gate: PASS (PLEASED + no mustFix) | PASS-WITH-FLAGS (INDIFFERENT + no mustFix, ≥1 flag) | BLOCKED (any mustFix, or ANNOYED, or INDIFFERENT+mustFix).
  feature: "${name}", claim: (echo the claim), groundTruthSibling: "${sibling}", state: "after".

Return ONLY the verdict object matching the schema. Be HONEST and exacting — a rubber-stamp without cited evidence is worthless.`,
    { label: `advocate:${name}`, phase: 'Advocate', agentType: 'user-advocate', schema: VERDICT_SCHEMA },
  ).then((v) => (v ? { ...v, feature: v.feature || name } : null)),
));

const valid = verdicts.filter(Boolean);
const summary = valid.map((v) => ({ feature: v.feature, net: v.net, gate: v.gate, mustFix: (v.mustFix || []).length, flags: (v.flags || []).length }));
return { count: valid.length, summary, verdicts: valid };
