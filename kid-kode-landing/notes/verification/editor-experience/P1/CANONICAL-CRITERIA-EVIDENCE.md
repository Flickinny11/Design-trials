# Canonical-3 criteria closed with evidence (RT-SC-03 / RT-SC-10 / RT-SC-11)

Verified 2026-06-17 in the running app (`:3001`, Chrome DevTools MCP `evaluate_script` on the live
WebGPU canvas). These three were advanced by the P1 Wave-2 built-freeze + the unified-scene mount and
are now closed with scene-graph evidence. Removed from `notes/verification/unmet-criteria.json`.

## RT-SC-11 — default viewMode on boot == preview-app
Fresh page load, viewMode read immediately after the canvas mounted, **before any `setViewMode` call**:
```
RT-SC-11_bootViewMode: "preview-app"   RT-SC-11_pass: true
```
(The transient `galaxy` seen earlier was a mid-transition read; a clean boot is preview-app — store
default `useGraphEditorStore.ts:354`, confirmed live.)

## RT-SC-10 — preview-app reuses canvas's mounted objects IN PLACE (INV-R4); no separate compiled player
- `page.tsx` mounts **only `GraphScene`** (read in full — no `PrismHost` in the live render tree).
- Live DOM at boot: `prismHostMounted: false`, `iframeCount: 0` (no separate compiled/blob player).
- **Same Object3D across modes** (the proof of in-place reuse, not a re-mount):
```
orr-arrival-watch group uuid in canvas:      d1c5b62d-a31b-4c40-ba52-6734e42108a1
orr-arrival-watch group uuid in preview-app: d1c5b62d-a31b-4c40-ba52-6734e42108a1
sameObjectInPlace: true
```
Preview-as-compile is an in-place state transition of the one scene — the `unmet` note ("page.tsx
currently mounts PrismHost XOR GraphScene") was stale.

## RT-SC-03 — single scene/canvas, never split-pane, selection survives every transition
- **One 3D scene**: the GraphScene canvas (1512×809). The only other canvas is the **2D minimap HUD**
  (180×140 corner widget, `Minimap.tsx:42` `getContext('2d')`) — a permitted composited HUD layer
  (INV-2), not a second 3D scene and not a split-pane. No split-pane dual-state anywhere.
- **In-place transitions** across galaxy↔canvas↔preview-app (same Object3D, RT-SC-10 above).
- **Selection survives every transition** (select watch in canvas, toggle through all modes):
```
afterSelect: orr-arrival-watch · inGalaxy: orr-arrival-watch · backCanvas: orr-arrival-watch · inPreview: orr-arrival-watch
selectionSurvives: true
```

## Still open (honest — NOT closed)
RT-SC-02 (CDN import-map three split — orthogonal, untouched), RT-SC-06 (Build pop-transition frames
not captured), NE-SC-01/NE-SC-03 (galaxy free-nav + deep zoom — untouched), NE-SC-13 (preview-faithful
half done via P1 Wave-2, but failing-edit→caption-repair not verified), NE-SC-14 (VisualPreview
regen-api 2nd path — deferred to P2 C9 decouple).
