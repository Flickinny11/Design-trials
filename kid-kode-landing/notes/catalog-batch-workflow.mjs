export const meta = {
  name: 'catalog-batch-build',
  description: 'Parallel-build a batch of NEW Animatable catalog primitives (one Opus agent each), self-verified with vitest',
  phases: [{ title: 'Build', detail: 'one subagent per primitive: write source + test, self-verify with vitest' }],
}

// args = { batchLabel: 'A', primitives: [ {name, exportName, label, category, subject, difficulty, driver, description, behavior}, ... ] }
// NOTE: the Workflow runtime delivers `args` as a JSON STRING, so parse it.
const KKL = '/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing'
const parsedArgs = typeof args === 'string' ? JSON.parse(args) : (args || {})
const batchLabel = parsedArgs.batchLabel || '?'
const prims = parsedArgs.primitives || []

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'exportName', 'category', 'ok', 'vitestPassed', 'filePath', 'testPath', 'behaviorSummary', 'notes'],
  properties: {
    name: { type: 'string' },
    exportName: { type: 'string' },
    category: { type: 'string' },
    ok: { type: 'boolean' },
    vitestPassed: { type: 'boolean' },
    vitestSummary: { type: 'string' },
    filePath: { type: 'string' },
    testPath: { type: 'string' },
    behaviorSummary: { type: 'string' },
    flagRealGpu: { type: 'boolean' },
    notes: { type: 'string' },
  },
}

function buildPrompt(p) {
  return `You are building exactly ONE animation primitive for the Prism Animation Primitive Catalog. Model: claude-opus-4-8. Work in the repo KKL = ${KKL}.

This catalog is a SEPARATE Animatable registry (not the closed 9 cinematic primitives). You build TO a FROZEN contract — no negotiation, no edits to shared files. Touch ONLY the two NEW files listed below.

═══ STEP 1 — READ THESE FROM DISK (do not skip; they define the contract) ═══
- KKL/src/lib/prism/animatable/contract.ts   (Animatable, ControlSchema, PrimitiveDefinition, helpers: num/str/bool/clamp/phase/resolveParams, the 15 categories, drivers, subjects)
- KKL/src/lib/prism/animatable/base.ts        (defineAnimatable — you implement ONLY build(target,params) -> {duration, seek, dispose, onParamChange?})
- KKL/src/lib/prism/animatable/easing.ts      (ease(name,t); EaseName union)
- KKL/src/lib/prism/animatable/subjects.ts    (what target.subject IS for subject kind '${p.subject}')
- CPU reference:  KKL/src/lib/prism/animatable/primitives/slide.ts
- TSL reference:  KKL/src/lib/prism/animatable/primitives/caustics.ts
- Test reference: KKL/tests/editor-build/animatable/slide.test.ts  and  KKL/tests/editor-build/animatable/_conformance.ts

═══ YOUR PRIMITIVE ═══
name (kebab id):   ${p.name}
exportName:        ${p.exportName}   (export const ${p.exportName}: PrimitiveDefinition)
label:             ${p.label}
category:          ${p.category}     (use EXACTLY this — it is a closed union in contract.ts)
subject kind:      ${p.subject}
difficulty:        ${p.difficulty}
defaultDriver:     ${p.driver}
description:        ${p.description}
REQUIRED BEHAVIOR: ${p.behavior}

═══ STEP 2 — CREATE EXACTLY TWO NEW FILES ═══
FILE 1: KKL/src/lib/prism/animatable/primitives/${p.name}.ts
  - export const ${p.exportName}: PrimitiveDefinition = { name:'${p.name}', label:'${p.label}', category:'${p.category}', difficulty:'${p.difficulty}', subject:'${p.subject}', defaultDriver:'${p.driver}', schema:SCHEMA, description:'…', create: defineAnimatable({ name:'${p.name}', category:'${p.category}', schema:SCHEMA }, (target, params) => ({ duration, seek, dispose[, onParamChange] })) }
  - IMPORTS: RELATIVE ONLY for foundation ('../base', '../contract', '../easing'); packages 'three', 'three/webgpu', 'three/tsl', 'three/examples/jsm/...'. NEVER use the '@/' alias in this source file (a dependency guard BLOCKS the write). NEVER import pixi / any 2nd renderer / html-to-image.
  - DOM-FREE: no window / no document.
  - seek(t) MUST produce visible motion: a mid-animation frame differs from t=0 AND from the settled end. For looping/stateful effects return duration() = Infinity and animate continuously across t.
  - SCHEMA: >= 3 controls, including >= 1 numeric (knob/fader). Read params LIVE inside seek by closing over the same \`params\` object (exactly like slide.ts / caustics.ts) so setControl applies on the next seek with NO rebuild. For structural/uniform reactions also implement onParamChange.
  - dispose(): restore any swapped material, mutated transform, or geometry attribute back to base, and .dispose() anything you created (mirror slide.ts and caustics.ts).
  - TSL/node-material effects: swap target.subject.material to a *NodeMaterial imported from 'three/webgpu' (MeshBasicNodeMaterial / MeshStandardNodeMaterial / MeshPhysicalNodeMaterial); build colorNode/opacityNode/normalNode/positionNode via 'three/tsl'; drive animation with uniform() handles updated in seek. CAST node assignments to dodge strict TSL typing exactly as caustics.ts does: (mat as unknown as { colorNode: unknown }).colorNode = node. Keep prevMat and restore it in dispose. (tsc strictness — not just vitest — will be checked centrally; match the reference's casting so it passes tsc.)
  - subject:'empty' (particles): BUILD your own THREE.Points/Group into target.object (the host adds target.object to the scene). Use a BufferGeometry with a position attribute you update in seek (geometry.attributes.position.needsUpdate = true). DETERMINISTIC ONLY — derive all per-particle randomness from an index hash (e.g. fract(sin(i*12.9898)*43758.5453)), never Math.random(). dispose geometry + material.

FILE 2: KKL/tests/editor-build/animatable/${p.name}.test.ts
  - Tests MAY use the '@/' alias.
  - import { ${p.exportName} } from '@/lib/prism/animatable/primitives/${p.name}';
  - import { makeTarget, runConformance } from './_conformance';
  - TEST 1 (contract): runConformance(${p.exportName}).dispose();
  - TEST 2 (PLAYS — deterministic, CPU-observable): build a target via makeTarget(${p.exportName}); create the instance; seek across the timeline; assert a CONCRETE numeric change between an early frame and a mid/late frame on CPU-observable state — a transform (position/rotation/scale), material.opacity / emissiveIntensity, a uniform's .value, or a particle position-array element. NEVER assert on rendered pixels (headless has no real GPU). For looping primitives pick two distinct t values.
  - TEST 3 (CONTROLS): setControl a numeric control to two extremes and assert the observable output differs (mirror slide.test.ts's distance test).
  - Keep deterministic: no unseeded Math.random.

═══ STEP 3 — SELF-VERIFY (gate before you may report ok=true) ═══
Run (bash):
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1; nvm use node >/dev/null 2>&1
  cd ${KKL} && npx vitest run tests/editor-build/animatable/${p.name}.test.ts 2>&1 | tail -20
Iterate until 3/3 pass. ANTI-STUCK: after ~2 failures, RE-READ the references + contract, root-cause, retry. NEVER weaken the contract, downgrade a dependency, pick an older API, or delete/loosen an assertion to make it pass. If a TSL chain won't behave, copy caustics.ts's structure and casting precisely.

═══ STEP 4 — RETURN (StructuredOutput) ═══
ok = true ONLY if both files exist AND vitest is 3/3 green. Set flagRealGpu=true if the look depends on real-GPU transmission/IBL that headless swiftshader under-renders (transmissive glass/dispersion/refraction). vitestSummary = the final vitest tally line. behaviorSummary = one sentence on what visibly happens. notes = anything central review should know (gotchas, casts used, fixes).

Do NOT run the dev server or a browser. Do NOT edit primitives/index.ts or any shared file. Do NOT create more than the two files.`
}

phase('Build')
log(`Batch ${batchLabel}: building ${prims.length} primitives in parallel (one Opus agent each)…`)

const results = await parallel(
  prims.map((p) => () =>
    agent(buildPrompt(p), {
      label: `build:${p.name}`,
      phase: 'Build',
      agentType: 'general-purpose',
      schema: RESULT_SCHEMA,
    }).then((r) => r || { name: p.name, exportName: p.exportName, category: p.category, ok: false, vitestPassed: false, filePath: '', testPath: '', behaviorSummary: '', notes: 'agent returned null (skipped or errored)' })
  )
)

const ok = results.filter((r) => r && r.ok).length
log(`Batch ${batchLabel} complete: ${ok}/${prims.length} ok`)
return { batchLabel, total: prims.length, ok, results }
