# POLISH MICRO-PASS -- Galaxy hero-world differentiation + Arrival hero composition + galaxy finish

MODEL GUARD: at start and after EVERY resume, confirm the running model is claude-opus-4-8 (check the runtime modelUsage, not the label). If anything else, STOP and write MODEL-MISMATCH to the ledger.

## MISSION
The Prism editor passed functional verification, but the chat-monitor visual-judge found polish gaps to the WOW bar on two FIRST-IMPRESSION surfaces. Close them. This is a SCOPED finishing pass, NOT a rebuild. Do NOT regress anything already passing (vitest 3349/0, prod build 18/18, tsc baseline, fix-pass atmosphere 20/20 + heroes 20/20, node-editor tabs A-E). Premium-first always; Observatory Brass (graphite/bone/brass/ice); NO purple in Prism-owned UI (real third-party brand logos keep their colors); one renderer (Three.js r184+ / TSL / WebGPU); no stock icons; MSDF text only; positions from node schema.

## SCOPE -- exactly these items, ranked
### PA (highest) -- Galaxy: the 5 hub-worlds must READ as hero worlds
At Galaxy overview zoom the five hub planets currently look too similar to the dormant node spheres, so the scene does not instantly read as 5 worlds each with orbiting nodes. Fix:
- Hub planets become unmistakably the heroes: substantially larger than node spheres (clear size hierarchy), each with a rich photoreal PBR surface and distinct per-hub identity (e.g. brass gas-giant, bone/ice rock, deep-ocean, ember) -- sharper surface detail, not soft low-contrast bands.
- Dormant node spheres stay subordinate: smaller, simpler, clearly orbiting their hub. Viewer sees hub-world + its moons at a glance.
- Keep 60Hz desktop and the mobile fallback; keep IBL / atmosphere-halo / bloom; sized by content per hubDiameters.
### PB -- Arrival hero: stop the artifact occluding the copy
On the Arrival hub the hero artifact (ORRERY watch) overlaps and occludes the headline (Time, machined.) and the intro line. Recompose so the artifact sits clear of both text lines and all three read cleanly, across desktop / tablet / constrained / mobile. Positions come from the node schema (responsiveScenePos) -- adjust there, not by hardcoding. Keep the artifact present + lit (do NOT regress heroes 20/20).
### PC -- Galaxy secondary finish (all of these)
- Content glance-icons: each dormant node carries a small premium custom 3D glyph badge showing content type (image / text / 3D-object / integration), legible at typical zoom, so nodes are identifiable at a glance not only by text label.
- Label LOD: declutter labels at element-detail zoom (fade/scale distant or non-focused labels) so labels never overlap into an unreadable mass.
- Graph edges: refine the bipartite-DAG connection lines -- thinner, softer, subtly curved, brass-tinted; remove the harsh bright-white look.
- Planet texture sharpness: raise hub-planet surface detail (less soft/low-res procedural blur).
- Hero artifact matte: remove the faint rectangular bounding-box halo around image-plane artifacts (clean matte / premultiplied edge).

## DECISIONS
D1 Procedural/code-driven first; no new fal media spend required for PA/PB/PC (glyph badges are vector/SDF; planet detail is procedural/shader). Keep run fal spend at 0 unless a clearly-better result needs it (then log it).
D2 Additive schema only (e.g. node.contentType for the badge, hub.identity for planet style) -- never break existing fields.
D3 If a fix risks a passing criterion, prefer the smaller safe change + note the tradeoff in the ledger.

## INVARIANTS (must hold)
INV-1 No regression: tsc baseline, prod next build, vitest all-pass, secret-leak clean, no fal token, atmosphere 20/20, heroes 20/20, node-editor A-E.
INV-2 60Hz desktop galaxy; mobile fallback smooth. INV-3 No purple in Prism-owned UI. INV-4 One renderer. INV-5 No stock icons (custom 3D glyphs only). INV-6 MSDF text only. INV-7 Positions from node schema.

## FORBIDDEN
FP-1 Rebuilding/replacing the galaxy or hero systems wholesale. FP-2 Hardcoding hero positions outside the schema. FP-3 Diffusion-drawn letterforms. FP-4 Stock/icon-font glyphs. FP-5 A second renderer. FP-6 Disabling/loosening any existing test or gate to make it pass. FP-7 Recoloring real third-party brand logos (leave as-is); no NEW purple in Prism UI.

## EXECUTION
Use ultracode parallel subagents per wave where work is separable (PA galaxy-planet shader/sizing, PB hero schema recompose, PC badges, PC label-LOD, PC edges can fan out -- they touch separable regions; serialize edits that touch the same GraphScene function). Self-heal with NO iteration cap until the acceptance gate passes. Commit at verified wave boundaries (standard exclusions).

## VERIFICATION GATE (all three layers, evidence-required)
1. NUMERIC HARNESS -- capture desktop+mobile galaxy and Arrival hero (all four viewports), compute with pass thresholds written to a log:
   - PA: hub-planet projected radius vs mean node-sphere radius ratio >= 2.5 at overview (clear hierarchy); 5 hubs detected.
   - PB: hero text-occlusion = 0 (headline + intro glyph bounds NOT overlapped by the artifact silhouette) on all four viewports; artifact still present + lit (coverage + peak as in heroes harness).
   - PC: edge max-brightness below a harshness threshold; node badge present + legible (min coverage) on dormant nodes; no label-overlap above threshold at detail zoom.
   - 60Hz perf retained.
2. COMPUTER-USE ADVOCATE -- the opus-4-8 subagent drives the REAL app like a non-technical user (desktop + mobile): open Galaxy -- do the 5 worlds instantly read as worlds with orbiting nodes? open Arrival in Preview -- are all three text lines fully readable with the artifact present? zoom to element detail -- labels readable + node types glanceable? Cite visual evidence for every verdict; MUST-FIX power for clear failures; net verdict must be PLEASED.
3. CHAT-MONITOR END REVIEW -- before the completion marker, capture final frames (galaxy overview, planet close, Arrival hero each viewport, element-detail) into notes/verification/polish/ and write the report so the monitor can do its own eyes-on.

## OUTPUT
- Report: notes/POLISH-REPORT.md (what changed, before/after numbers, frame paths, no-regression evidence: tsc/build/vitest/secret-leak/fal).
- Ledger: notes/verification/POLISH-PROGRESS.md (resumable; update each wave; model check each resume).
- Frames: notes/verification/polish/{galaxy,hero,detail}/.

## COMPLETION
When all three gate layers pass with evidence, append a final line to the report and STOP:
POLISH: RUN COMPLETE

## LOGAN-INBOX
Poll kid-kode-landing/notes/LOGAN-INBOX.md at each wave boundary; if it contains a directive, honor it.

## MONITOR FEED (append-only -- keeps the chat monitor informed at each phase)
At each phase/wave boundary (start AND done), each advocate verdict, each MUST-FIX raised or resolved, and final completion, append ONE concise line (under 200 chars) to kid-kode-landing/notes/MONITOR-FEED.md as: [<time>] POLISH <phase-or-event>: <status> | scores | verdict | next. Never delete prior lines.
