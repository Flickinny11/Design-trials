# ⛔ DRIFT CONTAMINATION NOTICE — 2026-06-29

The original `docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md` from 2026-06-27
was CONTAMINATED. It has been quarantined at:

`_QUARANTINE_DRIFT/contaminated-workspace-spec-2026-06-30/PRISM-WORKSPACE-COMPLETION-SPEC.v1-contaminated.md`

The live file path now contains a guarded recovery draft. Do NOT build from it
unless `spec-intent-check.mjs` and `prism-autonomy-preflight.mjs` pass for the
specific phase prompt.

WRONG ideas in it (authored by Claude, NOT founder intent) — must NOT be built:
1. "Retire the legacy `/` editor" — FALSE. The `/` editor (src/components/editor, ~300 files) is the REAL, working canvas editor. Nothing is legacy. Do not touch/retire/replace it.
2. "Click-to-edit from PREVIEW" — WRONG. Editing happens in the CANVAS. Preview is the camera-locked running app; you never edit from it.
3. "Galaxy as a full directory [rebuild]" — OVERSTATED. The galaxy ALREADY is the directory (hubs/nodes). It needs VERIFYING, not rebuilding.
4. Per-node "capability glyphs" — an unrequested invention. Drop unless founder wants it.

The old W-3/W-4/W-5 prompt files are quarantined in `_QUARANTINE_DRIFT/`.
CHAIN-STOP is present. See HANDOFF-2026-06-29.md.
