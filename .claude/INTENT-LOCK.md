# PRISM — INTENT-LOCK (founder's protected facts) — machine-enforced

Source of truth for the drift-prevention gates (Pillars 1–3 + 5). The hooks in
`.claude/hooks/{intent-lock-gate,destructive-action-guard,no-remote-asset-gate}.sh`
and `kid-kode-landing/scripts/spec-intent-check.mjs` read these facts. The Ruler
(`PRISM-INTENT-ANCHOR.md`) is the human authority; this file is its enforceable subset.

## PROTECTED PATHS — never delete / retire / "migrate away" / replace (without FOUNDER-SIGNOFF)
- `kid-kode-landing/src/app/page.tsx`            ← the `/` route (the real working editor mount)
- `kid-kode-landing/src/components/editor/**`    ← the 302-file canvas editor (THE PRODUCT)
- `kid-kode-landing/src/components/editor/keyframe/**` + `overlays/KeyframeEditor.tsx`  ← keyframe editor
- `kid-kode-landing/src/components/editor/walkthrough/**`  ← the tutorial / guided tips (KEEP)
- `kid-kode-landing/src/lib/prism/**`            ← the engine/runtime (real; do not "rebuild")

## LOCKED ARCHITECTURE FACTS (any spec/prompt contradicting these is DRIFT)
1. The `/` editor (`src/components/editor`) is the REAL, working canvas editor. Nothing about it is "legacy." Never retire / remove / migrate-away / replace it.
2. Editing happens in the CANVAS (and the node editor for purpose). PREVIEW is the camera-locked running app — you NEVER edit from preview.
3. The GALAXY already IS the directory (hubs/nodes). It is VERIFIED/finished, never "rebuilt as a directory."
4. View modes are exactly three: `galaxy | canvas | preview-app`. `hub-world` / `preview-hub` / `split` / `editor` are retired.
5. NO REMOTE ASSETS at runtime/build of editor chrome or scene: no CDN HDRIs/textures/meshes, no drei `<Environment preset=...>`, no `esm.sh`. Assets are local under `public/**`. (This is what crashed the canvas on 2026-06-29.)
6. A restyle is SURFACE-ONLY: it keeps every button, every function, the keyframe editor, and the tutorial fully working. Any change that drops a button or breaks a function is rejected.
7. No spec/prompt becomes build-truth, and no `SUPERSEDES` / `Canonical` / `ACTIVE build-truth` self-promotion stands, without a `# FOUNDER-SIGNOFF: <YYYY-MM-DD>` token. "Recency wins" never authorizes a loop-edited spec (Ruler §5).
8. Per-node `capability glyphs` as named in the 2026-06-29 W-4 prompt are NOT approved build-truth. The ruler allows useful visual/content icons in galaxy, but that W-4 glyph system was a planner invention and needs founder signoff before build.

## FORBIDDEN PHRASES in specs/prompts/orchestrators (blocked unless FOUNDER-SIGNOFF present)
- retire / remove / migrate-away / replace + (the) `/` editor | components/editor | legacy editor
- edit from preview | click a running element … edit | prompt-edit from preview
- rebuild the galaxy (as a / full) directory
- capability glyphs
- self-promotion: `SUPERSEDES <canonical spec>`, `ACTIVE build-truth`, `Canonical (additive)` — without signoff

## OVERRIDE
A founder-approved exception carries, in the payload, a line:
`# FOUNDER-SIGNOFF: <YYYY-MM-DD>`
This is the founder's explicit, dated confirmation against the real codebase. Agents MUST NOT add this token themselves — only the founder authorizes it.
