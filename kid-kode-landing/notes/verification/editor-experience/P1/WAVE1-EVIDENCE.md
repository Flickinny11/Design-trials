# P1 Wave 1 — Discard (C6) + pending-count (C2) — VERIFIED

**Change:** `src/components/editor/panels/Inspector.tsx` (one file, additive):
- `handleDiscard` → `usePreviewStateStore.getState().discard(selectedId)` (clears the per-node
  staging overlay back to last committed/built state; no source write, no rebuild).
- A **Discard** action button (enabled only while staged edits exist), matching the slab-less
  action buttons (Change Artifact / Preview in App UI).
- `previewPendingCount` shown on the Save button → **`Save (N)`** so the staged-edit count is
  always visible. Completes the staging contract (Save / Build / **Discard**).

## Verification (running app, Chrome DevTools MCP, `orr-arrival-watch` in canvas)
| step | overlay dirty | Save button | Discard | canvas group.x |
|---|---|---|---|---|
| stage 1-field overlay edit | true | **"Save (1)"** | **enabled** | 1 (ghost) |
| click Discard button (real DOM click) | **false** | **"Saved"** | **disabled** | **0 (reverted to source)** |

Frame: `wave1-staged-save-count.png` (Inspector open on the watch; action row intact, no overflow).

## Gates
- tsc: **10 total (0-new)**, no Inspector errors.
- Console errors: **0**.
- `live-graph.json`: untouched (Discard only clears the in-memory overlay; source never written).

## Deferred (with rationale)
- **C8-A orphan-store reroute** (VisualTab color pickers + AnimationTab frame faders →
  `useAnimationEditsStore`): folded into **P2**. The VisualTab "Primary/Accent color" pickers write
  `visualSpec.primaryColor` (shown only as a thin accent rail; the 3D node's real color comes from
  `materialSpec`/`textSpec.fill` in MaterialTab/TextTools, already overlay-routed). Rerouting is
  entangled with the VisualTab-vs-MaterialTab color duplication = the C9 Inspector-decoupling work.
  Frame faders (FrameProps) have no clean schema home and are also the P7 history source. Fixing
  these cleanly belongs with P2/P7, not a half-measure here.
- **C2 minimap dirty marker** (the Inspector-side count + existing "Dirty — rebuild" badge are done;
  a minimap node marker is a small follow-up).
- **Wave 3** (NE-SC-14 retire VisualPreview regen 2nd path; C7 staged-validation) — folds with P2 C9.
