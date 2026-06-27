export const meta = {
  name: 'edit-i3-judges',
  description: 'Three fresh-context judges (advocate / aesthetic / spec-conformance) for PRISM EDIT-I3',
  phases: [{ title: 'Judge', detail: 'advocate + aesthetic + spec-conformance in parallel' }],
};

const ROOT = '/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing';
const EVID = `${ROOT}/notes/verification/edit-i3`;
const SPEC = `${ROOT}/docs/prism/PRISM-EDITOR-INTEGRATION-SPEC.md`;

const LOOK = `The founder-approved aesthetic ground truth is /toolbar-chassis + /keyframe-editor:
- WORN-ALLOY METAL (Iron-Man-suit brushed/satin alloy with micro-scratches + patina) for cube buttons / fader knobs / rails.
- REAL TRANSMISSION GLASS panes (MeshPhysicalMaterial transmission=1, true ExtrudeGeometry thickness, milled cutouts) — never flat, never plastic, never DOM.
- ENGRAVED-IN-GLASS MSDF labels (CompositeText), jewel-tone accents, studio IBL + AgX tone-mapping.
HEADLESS CAVEAT: these frames are offscreen WebGL2 fallback, so REALIZED app nodes (e.g. dropped cubes) read as flat OPAQUE WHITE — that is the known fallback artifact, NOT a style defect. The docked CHROME glass (toolbar / library / inspector / keyframe panel / docks) still reads luminous & transmissive in the same frames; judge the CHROME. The real /editor runs WebGPU where realized nodes refract correctly.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'gate', 'mustFix', 'summary'],
  properties: {
    verdict: { type: 'string', description: 'overall verdict word (e.g. PLEASED / PASS / CONFORMS / MIXED / FAIL)' },
    gate: { type: 'string', enum: ['PASS', 'FAIL'] },
    mustFix: { type: 'array', items: { type: 'string' }, description: 'blocking MUST-FIX items (empty if none)' },
    summary: { type: 'string', description: '2-4 sentence justification citing specific evidence frames/metrics' },
  },
};

phase('Judge');

const [advocate, aesthetic, spec] = await parallel([
  () => agent(
    `You are a fresh-context USER-ADVOCATE judging Prism EDITOR phase I-3 (Inspector + Manipulation + Keyframe) AS A FIRST-TIME, NON-TECHNICAL USER, from EVIDENCE ONLY (rendered frames + measured metrics) — never from source.
Your task to evaluate: "select an element, change it in the inspector, move and stack it, connect two, then keyframe one and scrub; report whether it works and matches the approved glass look."
Read these (use the Read tool on the PNGs to SEE them):
- ${EVID}/e2e-01-editor.png ... e2e-07-galaxy.png (the continuous flow)
- ${EVID}/insp-01-selected-cube.png, insp-03-width-widened.png (inspector edits)
- ${EVID}/manip-07-gizmo-visible.png, manip-05-connected.png (gizmo + connector)
- ${EVID}/kf-02-key1.png (keyframe panel)
- ${EVID}/behavioral-metrics-i3.json (measured proof: schema edits, gizmo deltas, stack, connectors, template, keyframe groupY delta, authorship orphans=0)
${LOOK}
Judge the 4 axes (STYLE / FUNCTION / INTUITIVENESS / SATISFACTION). FUNCTION is proven by the metrics (every check PASS, 0 orphans, 0 console errors). A verdict without citing specific frames/metrics is INVALID. gate=FAIL only for a real blocking defect.`,
    { label: 'advocate', phase: 'Judge', agentType: 'user-advocate', schema: SCHEMA },
  ),
  () => agent(
    `You are a fresh-context AESTHETIC judge for Prism EDITOR phase I-3. Decide whether the docked editor CHROME matches the founder-approved glass look.
${LOOK}
Read (Read tool on PNGs to SEE them): ${EVID}/e2e-02-inspector-edit.png, ${EVID}/e2e-03-gizmo.png, ${EVID}/e2e-06-keyframe.png, ${EVID}/insp-01-selected-cube.png, ${EVID}/manip-07-gizmo-visible.png, ${EVID}/kf-02-key1.png.
Specifically judge: the docked INSPECTOR (worn-cube fader knobs on milled rails + engraved labels + value readouts + tint swatches), the transform GIZMO (worn-alloy handles + mode/action chips + cyan selection ring + glass-tube connector), and the KEYFRAME timeline (worn track rails + playhead + transport chips). Does it cohere with /toolbar-chassis + /keyframe-editor (worn metal + transmission glass + engraved MSDF)? List any genuine style regressions as mustFix (ignore the known WebGL2 opaque-white realized-node fallback). gate=FAIL only for a real style regression in the chrome.`,
    { label: 'aesthetic', phase: 'Judge', agentType: 'claude', schema: SCHEMA },
  ),
  () => agent(
    `You are a fresh-context SPEC-CONFORMANCE reviewer for Prism EDITOR phase I-3. Read the spec ${SPEC} (§3 phase I-3 + §0 invariants + §1 completeness) and the I-3 implementation diff, then decide conformance.
Get the diff and source with Bash/Read:
- cd ${ROOT} && git -C /Users/loganbaird/Prototype_Prism/Design-trials log --oneline -6
- git -C /Users/loganbaird/Prototype_Prism/Design-trials diff e8b96286..HEAD -- kid-kode-landing/src/components/editor-shell kid-kode-landing/src/lib/prism-graph/types.ts | head -1200
- the new editor-shell files: editor-inspector.tsx, editor-shell-controls.tsx, EditorGizmo.tsx, EditorConnectors.tsx, editor-manipulation.ts, EditorKeyframeDock.tsx, use-editor-keyframe-store.ts
- metrics: ${EVID}/behavioral-metrics-i3.json
Verify the I-3 deliverables: (a) INSPECTOR selects a node and edits its FULL schema per type (geometry/material/transform), live; (b) MANIPULATION: transform gizmos (move/rotate/scale), stack (parent-child), connect (edges + 3D connectors), snap/align, group, save-as-template; (c) KEYFRAME panel animates the selected node. And the INVARIANTS: ADDITIVE (labs untouched — no lab files changed), NODE LAW (edits write the live graph / node.keyframes; node-authorship --editor PASS 0 orphans), STACK LAW (no DOM — no-dom-ui PASS), and the additive-only schema change (PrismNode.parentNodeId optional). Report VIOLATES items as mustFix. gate=FAIL only for a true spec violation or forbidden-pattern drift.`,
    { label: 'spec-conformance', phase: 'Judge', agentType: 'prism-criteria-reviewer', schema: SCHEMA },
  ),
]);

return { advocate, aesthetic, spec };
