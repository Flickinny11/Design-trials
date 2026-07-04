# PRISM — GALAXY NODE SEMANTICS FIX — Fable 5 — 2026-07-01

## MODEL
You are Claude Fable 5. This run is Fable-5-only — NO fallback to any other model.
Ultrathink before you act and while you work. Evidence, not assertions.

## READ FIRST (ground yourself — do not skip, do not assume)
1. Completion spec: kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md
   — especially "Protected Ground Truth", Completion Goal #2 (Finish Galaxy
   Semantics), and "Forbidden Drift". Comply with it.
2. Your own prior analysis: kid-kode-landing/notes/FABLE5-SETUP-ANALYSIS-2026-07-01.md
3. WS-W5 report: kid-kode-landing/notes/WS-W5-REPORT.md (current galaxy numbers:
   ~148 overview nodes; 179 collapsed = 107 shell + 72 hit-target; a
   component-atom projection surfacing 56 of 148 at first level).
4. The REAL galaxy code — read the current implementation and follow it end to end:
   - kid-kode-landing/src/lib/prism-graph/galaxy-semantics.ts (projection logic)
   - the galaxy view / GraphScene node→sphere mapping and how background/ambience
     is rendered
   - kid-kode-landing/scripts/node-authorship-gate.mjs (how nodes are counted/gated)
   - kid-kode-landing/public/prism-mock/home/live-graph.json (the actual node data)
   Determine the CURRENT node taxonomy from the code — do not assume the historical
   one below is still verbatim.

## THE CONCEPTUAL MODEL (founder context — much is already true; internalize it)
- Prism is ONE graph/runtime shown in THREE views: GALAXY, CANVAS, PREVIEW.
- GALAXY = the app "directory" as a solar-system of NODES. Hubs are PAGES; nodes
  are the app's real UI ELEMENTS (and capabilities). It is the structural /
  "unbuilt" view — navigable spheres.
- CANVAS = the drag-and-drop VISUAL editor — author/arrange/edit the built app
  elements in 3D.
- PREVIEW = the BUILT app running, camera-locked. For this prototype the built app
  is the ORRERY watch app — the "mock app" that is built BY the editor and used as
  verification data. THE MOCK APP (watch app) IS NOT THE EDITOR; it is the app the
  editor builds.
- The NODE EDITOR gives each node its FUNCTION; the SCHEMA (behavior/data/bindings)
  is critical.
- So: galaxy = structural nodes; node-editor + schema = function; canvas = visual
  drag-drop authoring; preview = the built result.

## THE PROBLEM (the whole job of this run)
In GALAXY view there are FAR too many nodes per hub, and it is hard to tell what
each node even is. There should be ~ONE node per REAL UI ELEMENT of the watch app
— NOT one per particle / dust / nebula / ambience / embedded decoration /
shell-internal. Founder hypothesis (confirm or refute with data): the 3D
BACKGROUND (particles/dust/nebula/lighting/ambience) and/or embedded decoration
are being represented as individual galaxy NODES, inflating the count.

Historical mechanism (VERIFY against current code): nodes carried an "editorRole" —
`element` (real UI elements → the only navigable spheres), `background`
(section/card fills, ambience → NOT galaxy nodes), `embedded` (text/decoration
inside a parent card → NOT galaxy nodes). A prior "section-cohesion enrichment"
introduced phantom node definitions that don't map to actual rendered UI; the fix
was a filter so only real elements show. The current code speaks in terms of
"shell", "hit-target", and "component-atom" projection — read it and establish the
CURRENT truth.

## YOUR TASKS
1. DIAGNOSE — write this to the report FIRST, with concrete evidence:
   - Per hub, count galaxy-overview nodes and categorize by role/type: real UI
     element vs background/ambience vs embedded decoration vs shell-internal vs
     hit-target. Use live-graph.json + the projection code.
   - Determine EXACTLY what inflates the count (which node ids/types). Confirm or
     refute the background-particles/dust hypothesis with data.
   - State the root cause in one clear paragraph.
2. FIX — targeted, NOT a galaxy rewrite (Forbidden Drift forbids a rewrite):
   - GALAXY overview shows ~one meaningful, IDENTIFIABLE node per real UI element
     of the watch app.
   - Background stars/dust/nebula/lighting/ambience are modeled as hub-owned
     BACKGROUND LAYERS (runtime/hub data), NEVER as individual galaxy nodes (per
     spec Protected Ground Truth).
   - Embedded decoration / shell-internals / hit-targets are collapsed out of the
     overview (kept as child/detail data, not first-class spheres).
   - Each visible galaxy node is clearly LABELED / identifiable (founder: "hard to
     tell what each node even was") — a readable caption per node.
   - Preserve CANVAS + PREVIEW behavior and the .prism runtime path. Do not alter
     the real /editor beyond the galaxy projection/labeling needed here.
3. VERIFY — real-browser + Fable 5 vision (the golden loop):
   - Verify against the live dev server for THIS branch (two are running: :3000 and
     :3001; WS-W5 used :3001 — confirm which serves the current branch and use it).
   - Screenshot GALAXY per hub; confirm the node count is now human-readable, every
     visible node maps to a REAL UI element with a readable label, and background
     renders as ambience (not spheres). Compare before/after counts.
   - Re-run galaxy-semantics + node-authorship gates + typecheck (0-new). Capture
     frames under kid-kode-landing/notes/verification/galaxy-nodes/.
   - The in-run user-advocate + prism-criteria-reviewer judges (Fable 5 vision)
     MUST PASS: a founder looking at galaxy can tell what each node is, it is
     one-per-element, and background is ambience.

## SCOPE / GUARDRAILS
- GALAXY NODE SEMANTICS ONLY. Do NOT touch the toolbar or keyframe-editor design —
  that is the NEXT run.
- Respect Forbidden Drift: no smaller editor shell; no authoring from Preview; NO
  full Galaxy rewrite; no stock-icon toolbar; no remote editor-chrome assets; no
  raw secrets; no hardcoded watch artifacts outside graph/runtime data; no full
  rebuild for a surgical change.
- Cite node ids, counts, gate outputs; attach frames. No assertions without proof.

## OUTPUT / COMPLETION
- Write diagnosis + fix + verification evidence to
  kid-kode-landing/notes/GALAXY-NODES-REPORT.md.
- When the fix is verified green (gates pass, judges pass, frames captured), end
  the report with the EXACT line:
  PRISM-GALAXY-NODES: RUN COMPLETE
- If a blocker needs the founder, write the reason + exact next action and end with:
  PRISM-GALAXY-NODES: BLOCKED-NEEDS-FOUNDER
