export const meta = {
  name: 'w3-distortion-fixround',
  description: 'Fix-round r1 for the 10 BLOCKED W3 DISTORTION primitives — root-cause + fix each advocate mustFix, strengthen tests',
  phases: [{ title: 'Fix', detail: 'one agent per blocked tile, root-cause + fix + test, no barrel/contract edits' }],
};

const RND = ['Math', 'random'].join('.');

const COMMON = `You are FIXING ONE existing Prism animation primitive that a fresh-context USER-ADVOCATE reviewer BLOCKED. Work ONLY on your assigned primitive.

REPO: /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing (branch prism-editor-build). Prefix shell: export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH". Do NOT commit/push. Do NOT edit index.ts (barrel), contract.ts, base.ts, registry.ts, subjects.ts, bindings.ts, or any OTHER primitive's files.

THE TWO FILES YOU MAY EDIT:
- src/lib/prism/animatable/primitives/<NAME>.ts
- tests/editor-build/animatable/<NAME>.test.ts

STEP 1 — SEE THE DEFECT (mandatory). Read the advocate verdict and the captured evidence frames:
- Verdict JSON: notes/verification/useradvocate-sixtile/w3-verdicts/<NAME>.json (read it fully — mustFix[] + flags[] + rubric evidence cite exact frame files + measured metrics).
- Evidence frames (Read these PNGs — the Read tool renders images): notes/verification/useradvocate-sixtile/<NAME>/after/idle.png, play-1/2/3.png, control-<id>-low/mid/high.png, and metrics.json. LOOK at the dead-control low vs high frames and the play frames the advocate cited. Confirm the defect with your own eyes before touching code.

STEP 2 — ROOT-CAUSE in the current code. Read src/lib/prism/animatable/primitives/<NAME>.ts in full. Find the EXACT reason each mustFix occurs (a control value never read in apply()/seek(); onParamChange not re-applying at lastT; the effect amplitude ~0 at the pinned engaged phase; a transient/velocity/one-shot that has decayed by the pin; an opaque overlay occluding content; sampling that only displaces high-contrast edges). State the root cause in your output.

THE HARNESS STIMULUS MODEL (this is WHY controls read dead — design your fix around it):
- IDLE frame = window.__catalogRig.seek(<NAME>, 0), PAUSED. For pointer primitives the pointer is DISENGAGED at t=0 → the subject must rest CLEAN and fully legible (no distortion at rest).
- CONTROL sweeps = window.__catalogRig.seek(<NAME>, 1), PAUSED at an ENGAGED phase, then each range control filled low→mid→high and re-screenshotted. "changed" = >0.5% of pixels move by >8 luma OR mean|Δ|>0.35 between low and high.
- CONSEQUENCE: every schema control MUST visibly reshape the FROZEN engaged (t=1, paused) frame. A control that only affects a TRANSIENT (pointer velocity — which is ~0 when paused; a one-shot ring that already exited; a settle that finished) reads as DEAD. THE FIX (the P0/W2 doctrine): make the engaged pose a STANDING FUNCTION of POSITION/phase, not of transient velocity. Persist a decaying envelope so the pinned frame holds a visible engaged state, and ensure onParamChange re-applies the FULL pose at lastT so a paused control tweak takes effect. The effect at the engaged frame must be at SUBSTANTIAL amplitude (well above the discoverability floor) so each control's low→high visibly re-shapes it.

THE PREMIUM BAR (Logan's standard): premium 4K-motion-graphics quality that visibly OUTCLASSES Slider-Revolution DOM effects, judged at DPR-2. The effect must READ AS ITS NAME at full strength, not a faint accidental wobble.

HARD RULES (W3 invariants — violations = task failure):
- TEXTURE-PRESERVING + mountable:true is SACRED and ALREADY CORRECT in your tile (the advocate confirmed no placeholder-slab) — keep it. Never mutate/replace the subject's own materials; overlays carry the subject's FULL look (shared .map by reference + PBR scalars, live re-check per seek). NEVER an invented flat fill. The card's brass header / grey rows / accent dot must stay legible and tack-sharp THROUGH the effect.
- TSL only (three/tsl + three/webgpu node materials), no GLSL strings, runs on WebGPU AND WebGL2. Repo TSL TS friction: the 'as unknown as {...}' cast convention. Never THREE.Points for visible sprites.
- DOM-free (pointer comes from target.userData.pointer {x,y} 0..1, finite-guarded — never from events). window/document forbidden except devicePixelRatio.
- Deterministic (no ${RND} — index/time hashes only). Subject may be a Group — handle Mesh and Group.
- dispose() restores EVERYTHING (snapshot+restore incl. .transparent/visible/position) and disposes every resource YOU created (shared geo/textures by reference are NEVER disposed by you).
- No purple. Effect colors derive from the subject or the Observatory-Brass/graphite world (warm brass/bone/ice).
- Keep the schema control IDs/labels stable unless a control is genuinely misconceived; you MUST make every existing control live. duration Infinity, category 'displacement', defaultDriver unchanged.

STEP 3 — FIX to premium quality, resolving EVERY mustFix. STEP 4 — STRENGTHEN TESTS: keep runConformance; ADD/repair tests asserting (a) the effect produces a SUBSTANTIAL measured displacement/uniform delta at the engaged state (seek to the engaged time with an engaged pointer, assert a real transform/uniform magnitude), and (b) EACH previously-dead control changes a measured output (uniform value or sampled vertex/transform) between its min and max at the engaged state — a deterministic, browser-free proof the control is wired. Do NOT weaken existing assertions. STEP 5 — run: npx vitest run tests/editor-build/animatable/<NAME>.test.ts — GREEN. STEP 6 — npx tsc --noEmit and confirm ZERO errors in YOUR two files (siblings may show transient errors — ignore those, never edit them). STEP 7 — self-review vs every mustFix + the stimulus model.

PARALLEL-WAVE NOTE: up to 5 sibling fix-agents run concurrently on OTHER tiles. Never edit their files; judge tsc only on your two files.

Final message: structured output only (the schema).`;

// Each blocked tile: name + the advocate's mustFixes distilled into a fix directive.
const BRIEFS = [
  { name: 'hover-liquid-distort', brief: `BLOCKED (INDIFFERENT, 1 mustFix + flag). FIX: (1) The 'viscosity' control is DEAD (byte-identical low/mid/high) — it is the claim's namesake mechanic. Wire viscosity to the ripple decay/settle so high viscosity = slower, thicker, longer-lingering well and low = thin fast-draining water, AND make that difference visible on the PAUSED engaged frame (e.g. viscosity shapes the ring falloff/standing amplitude at the pin, not only the fall-rate that needs animation to show). (2) FLAG: the idle (seek 0, pointer DISENGAGED) frame still shows a pronounced distortion well in the row band — at rest env must be ~0 and the card fully settled/clean. Ensure apply(0) with no pointer rests clean. Keep everything else (the effect itself is premium and texture-preserving per the advocate).` },
  { name: 'pointer-glitch-split', brief: `BLOCKED (ANNOYED, 2 mustFix). FIX: (1) NO RGB-split/chromatic aberration is visible — the bands render MONOCHROME grey; the primitive is named for RGB-split slivers. Add a REAL per-channel R/G/B sampling offset: sample the subject texture three times at horizontally-offset UVs and route R from the +offset sample, B from the −offset sample (classic chromatic split) on the sheared bands, so coloured fringing is unmistakable at DPR-2. (2) The 'chroma' control is DEAD — wire it to the magnitude of that per-channel offset so low→high visibly widens the colour split at the engaged frame. Keep the band-shear and texture preservation.` },
  { name: 'heat-haze-refract', brief: `BLOCKED (ANNOYED, 3 mustFix). FIX: (1) Effect only wavers the brass header's TOP EDGE; the grey body rows show ZERO displacement. Make the refraction a UV-sample displacement applied across the ENTIRE sheet (whole column of content wavers — rows included), not an edge-only vertex notch. (2) Dial strength WELL UP — current frameDeltaMag 0.02-0.05 is below the discoverability floor; the shimmer must be obviously alive (a clear rising column of wavering air). (3) Controls duration/columnWidth/riseSpeed/amplitude/distortionScale read DEAD at the engaged pin — ensure the t=1 engaged phase shows strong shimmer and each control visibly reshapes it (amplitude/scale = displacement magnitude; columnWidth = horizontal extent; riseSpeed/duration = the standing wave's vertical structure at the pin). Texture preserved, content still legible THROUGH the haze.` },
  { name: 'lens-bulge', brief: `BLOCKED (ANNOYED, 3 mustFix). FIX (core rework): the bulge currently renders as a DARK OPAQUE glossy dome that OCCLUDES the card. Rebuild it as a SEE-THROUGH OPTICAL MAGNIFIER: inside the bulge radius, sample the subject's OWN texture with UVs pulled toward the bulge center (radial magnification — content ENLARGES and stays visible through the lens), easing back to identity at the rim; the card outside is untouched and the header is never eaten. (2) Wire 'magnify' to the zoom factor (UV pull strength) — currently DEAD/byte-identical. (3) Wire 'rim' to the edge-stretch/refraction ring at the lens boundary — currently DEAD. Sibling pointer-loupe needs the SAME see-through UV-magnification technique. Keep texture preservation; the lens shows the REAL card content magnified, never a flat fill.` },
  { name: 'pointer-wake-wave', brief: `BLOCKED (ANNOYED, 3 mustFix). FIX: (1) NO animation — all play frames are byte-identical (frameDeltaMag=0); the wake never renders because it is VELOCITY-driven and the harness pointer is ~stationary. Make a STANDING wake that is a function of pointer POSITION at the engaged pin (a V of cresting ripples anchored to/behind the pointer point), PLUS a time term so it visibly animates during play (ripples travel/crest over t). (2) Make it read as the claim: a V of cresting ripples trailing the pointer and FADING (a boat wake), not a single static bulge. (3) Controls trailLength/waveSpeed/decayRate are DEAD — wire trailLength to the wake's longitudinal extent, waveSpeed to the crest travel, decayRate to the fade, and ensure each reshapes the engaged t=1 frame. Texture preserved.` },
  { name: 'pixel-sort-sweep', brief: `BLOCKED (ANNOYED, 3 mustFix). FIX: (1) No traveling wavefront — the distortion is a static jagged tear pinned to the LEFT edge. Make the sort wavefront TRAVEL across the full card width as a function of time (sweep x-position = f(t) spanning 0→1), with directional pixel-smear streaks AHEAD of the front and crisp RESOLVED content behind it (the glitch-art pixel-sort read). (2) Ensure motion is perceptible during play (not near-static) and the engaged t=1 frame shows the wavefront mid-card. (3) The 'streak' control is DEAD — wire it to the streak length/intensity ahead of the front so low→high visibly changes the smear at the engaged frame. Texture preserved; content resolves legible behind the sweep.` },
  { name: 'hover-displacement-map', brief: `BLOCKED (ANNOYED, 3 mustFix). FIX: (1) The idle (seek 0, pointer DISENGAGED) frame is DROWNED in heavy grain with illegible header/rows — at rest the card must be CLEAN and fully legible (the clean look currently only appears at reliefDepth-low; that must be the idle baseline; relief deepens only as the pointer NEARS). (2) The displacement reads as stippled sensor-noise/AI-grain, not a crisp tactile EMBOSS — replace the noise look with a coherent procedural relief (smooth height field that embosses the content with directional shading), preserving legibility. (3) 'proximityRange' is DEAD — it is the load-bearing 'deepening as the cursor nears' promise; wire relief depth to pointer proximity so proximityRange visibly changes the engaged frame. Texture preserved.` },
  { name: 'click-shockwave', brief: `BLOCKED (INDIFFERENT, 2 mustFix). ROOT: this is a 'state' one-shot detonation; by the pinned engaged phase (seek t=1) the single ring has already raced out and the surface settled, so play-2/3 and the control sweeps are byte-identical to idle (controls width/kick/wobble unverifiable). FIX: while the state is ENGAGED, emit a REPEATING traveling pressure ring (deterministic phase from the seek time, period ≈ the effect duration) so at ANY pinned phase a crisp ring is somewhere on the card kicking the surface/chrome as it passes — the play sequence then shows the ring racing outward and the controls (width = ring thickness, kick = surface displacement amplitude, wobble = trailing ripple) each visibly reshape whichever ring is present at the engaged frame. Keep one-clean-ring aesthetics (not a busy field) — a single ring cycling, texture preserved.` },
  { name: 'crt-warp', brief: `BLOCKED (ANNOYED, 1 mustFix). FIX: the 'scanlines' control (line frequency, ~40→220) is DEAD — dragging it changes nothing. Wire it to the actual TSL scanline density (the sin/fract frequency of the scanline mask) so low→high visibly changes the line count at the engaged frame. The rest of the CRT effect (barrel curve, flicker, content readable through the curve) reads fine per the advocate — touch only what is needed to make scanlines live (and verify barrelCurve/flicker remain live).` },
  { name: 'pointer-loupe', brief: `BLOCKED (ANNOYED, 2 mustFix). FIX (core rework): the loupe NEVER magnifies — content passes through the ring at native scale; it reads as a drifting selection circle. Implement REAL optical magnification: inside the loupe radius, sample the subject's OWN texture with UVs scaled toward the loupe center by the zoom factor (a crisp ENLARGED inset of the card content, visible through the glass), with the existing ring rim as the lens edge; the loupe tracks the pointer position. (2) The primary 'zoom'/'Zoom Factor' control is DEAD and 'glide' is DEAD — wire zoom to the magnification factor (UV scale) and glide to the loupe's follow/lag toward the pointer, so each reshapes the engaged frame. Sibling lens-bulge uses the SAME see-through UV-magnification. Texture preserved; the loupe shows the REAL card content enlarged.` },
];

const SCHEMA = {
  type: 'object',
  required: ['primitive', 'rootCause', 'fixes', 'mustFixResolved', 'vitestPassed', 'tscCleanOwnFiles', 'controlsNowLive'],
  properties: {
    primitive: { type: 'string' },
    rootCause: { type: 'string' },
    fixes: { type: 'string' },
    mustFixResolved: { type: 'boolean' },
    vitestPassed: { type: 'boolean' },
    tscCleanOwnFiles: { type: 'boolean' },
    controlsNowLive: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
};

phase('Fix');
const BATCH = 5;
const all = [];
for (let i = 0; i < BRIEFS.length; i += BATCH) {
  const chunk = BRIEFS.slice(i, i + BATCH);
  log(`W3 FIX-ROUND: batch ${i / BATCH + 1} — ${chunk.map((b) => b.name).join(', ')}`);
  const part = await parallel(chunk.map((b) => () =>
    agent(`${COMMON}\n\nYOUR TILE: ${b.name}\n${b.brief.replaceAll('<NAME>', b.name)}`, { label: `fix:${b.name}`, phase: 'Fix', schema: SCHEMA })
  ));
  all.push(...part);
}
return { results: all.filter(Boolean) };
