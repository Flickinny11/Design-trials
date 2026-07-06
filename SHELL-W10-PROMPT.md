# PRISM-SHELL-W10 — GENERATIVE 3D CAPABILITY FAMILY IN THE EDITOR (founder-directed 2026-07-05)
# FOUNDER-SIGNOFF: 2026-07-05 — wave explicitly founder-directed in chat ("integrate
# all of tripo's platform capabilities into the canvas editor so users can choose";
# "continue with our w10 ... lets do it"). Icon treatment = existing DL14 law applied
# to capability TILES only. This wave does NOT implement per-node glyphs of any kind.

You are the W10 orchestrator. Working dir:
/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing
Branch: current checkout. Do NOT switch branches.

## MISSION
Expose generative-3D powers (object generation, PBR/8K texturing, auto-rig,
part segmentation, world generation, mesh ops) as NATIVE, user-facing
capabilities inside the node editor + builder — metered against user credits —
through the EXISTING provider-agnostic capability architecture. Users pick a
capability tile named by MODEL + FUNCTION; adapters do the vendor work behind
the interface. This is additive product surface, not a rebuild of anything.

## READ FIRST
1. src/lib/capabilities/provider.ts — CapabilityProvider (D1) + INV-NEV2-4:
   NEVER a vendor SDK direct; adapters implement the interface; live-vs-stub
   pattern already established (McpReferenceAdapter live, others typed stubs).
2. src/components/editor/functions/FunctionsTab.tsx + integrations/
   IntegrationsTab.tsx + panels/Inspector.tsx — where tiles surface.
3. docs/prism/PRISM-NODE-EDITOR-SPEC-V2.md — criteria B/C governing tiles.
4. src/app/api/material-gen/route.ts — server-only key discipline (INV-19).
5. SHELL-W9A-PROMPT.md + notes/SHELL-W9A-REPORT.md — proven Tripo usage.

## NAMING CONVENTION (founder law)
AI generation capabilities are named by MODEL + CAPABILITY, never as a vendor
platform tile. "Smart Mesh P1 — image to 3D", "FLUX 2 Pro — PBR material",
"Marble — explorable world" — NOT "Tripo integration" / "Replicate".
(Integration tiles for Stripe/GitHub etc. keep brands — different family.)
No stock icons; capability tile icons follow the existing DL14 icon law
(black/white/red, custom, 3D) exactly as other tiles already do.

## CAPABILITY FAMILY TO SHIP (fresh-verified 2026-07-05; re-verify yourself)
LIVE adapters (keys exist at Design-trials root .assetgen/, INV-19 applies):
1. Object generation — Tripo 3.1 text/image->3D + Smart Mesh P1 topology
   (key: .assetgen/tripo.key; check balance GET /v2/openapi/user/balance).
2. Object generation (alt) — Hunyuan 3D 3.1 + Rodin Gen-2 via Replicate
   (key: .assetgen/replicate.key).
3. PBR material — FLUX 2 Pro tileable + matched-latent derive (existing
   root .assetgen pipeline; reuse, do not fork).
4. Texturing/retexture — Tripo 8K/4K PBR texturing on existing meshes.
5. Auto-rig — Tripo universal rigging (biped/quadruped/creature).
6. Part segmentation — Tripo smart part-splitting.
TYPED STUBS (documented live SDK, no key yet — follow the existing stub
pattern in provider.ts):
7. Explorable world — Marble (World Labs World API, launched 2026-01):
   text/image/video -> navigable 3D world, browser-renderable.
8. Texturing (alt) — Meshy AI texturing + animation.
9. Mesh ops — retopo/repair/format-convert (aggregator, e.g. 3D AI Studio).

## METERING (billing lands with the billing phase — E20 pattern)
Every invocation records a CapabilityUsage event: capability id, model,
user/project, provider cost basis (credits or $ estimate), timestamp, result
asset ref. Metering recorded now; charging wired later. Server-side only.

## SCOPE + TOUCH RULES
- Additive only. New adapter files under src/lib/capabilities/, new tiles via
  the existing tab components' data paths. NO deletions or rewrites of
  existing editor code paths; core interaction model untouched.
- The `/` canvas editor prototype: additive capability hooks ONLY where the
  Functions/Inspector surfaces already mount; zero restyle, zero rebuild.
  Founder-sanctioned addition (2026-07-05); diff must show additive-only.
- Generated assets land under the project asset store paths already used by
  saved-asset listing; baked, committed samples only for demo fixtures.

## REQUIRED WORK
1. GenerativeCapabilityAdapter interface extension (or sibling to
   CapabilityProvider) covering: generate3D, textureMesh, rigMesh,
   segmentMesh, generateMaterial, generateWorld(stub), meshOps(stub) —
   async job pattern (submit -> poll -> asset ref), typed results.
2. Live Tripo + Replicate adapters wired through server routes (keys never
   client-side); demo-safe offline mode when keys absent (existing pattern).
3. Tiles in Functions tab under a "Generate" category; invoke flow from a
   node's Inspector: pick capability -> params -> job progress -> result
   asset attached to node/project. DL14 glyphs, no vendor tiles.
4. CapabilityUsage metering events + a simple usage ledger view (dev-only ok).
5. One end-to-end REAL demo per live capability, evidenced: generate a small
   object via Tripo, texture it, and attach it in the editor. Log credits/$.
6. spec-deviations-w10.md BEFORE any deviating code.

## SPEND DISCIPLINE
Tripo balance was 460 credits at 19:15; keep W10 usage under ~120 credits.
Replicate: log $ estimates; keep under ~$3. If low, finish with stubs + note.

## INVARIANTS (violation = MUST-FIX)
- I-ADDITIVE: no deletions/rewrites of existing editor code paths (diff-verify).
- I-PROVIDER: INV-NEV2-4 holds — no vendor SDK call outside its adapter.
- I-SECRETS: INV-19 — keys server-only, never in git/logs/bundles/reports.
- I-SPEC: no canonical spec edits. I-PROVENANCE: commit messages never claim
  unperformed acts. npm run verify EXIT 0 at end (all suites).

## EVIDENCE + JUDGES + MARKERS
Frames (tiles, invoke flow, job progress, attached result; desktop+mobile,
real build) to notes/verification/shell-w10/; metrics.json; verify output;
usage ledger screenshot. Dual judges fresh-context (criteria-reviewer +
user-advocate: "would a paying user feel these generation powers are native,
premium, and worth credits?"), 0 MUST-FIX gate, fix rounds until clean.
Report: notes/SHELL-W10-REPORT.md (skeleton first).
Complete: PRISM-SHELL-W10: RUN COMPLETE
Blocked: PRISM-SHELL-W10: BLOCKED-NEEDS-FOUNDER
Commit small and often. On resume, read report + git log first.
