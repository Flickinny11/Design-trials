# P6 Evidence — 3D background authoring (2026-06-18)

Background agent (opus). tsc 0-new (baseline 9), anti-drift clean, dock drag/collapse code (P2a) untouched (verified by diff).
Orchestrator live verification appended after the P5+P6 combined browser pass.

- **C29 self-explanatory + previewable:** each of the 5 HubBackgroundPicker preset cards gains a per-card CSS preview
  swatch (zero extra WebGPU canvas — perf-safe) conveying nebula vs particles vs plate vs splat, plus plain-language flow
  (Select preset · Adjust params sliders · Generate (fal, with honest disclosure) · Clear/Apply-to-this-hub). Existing
  labels + Density/Drift/Depth/Glow sliders preserved.
- **C30 discoverable Canvas entry:** new "Background" tool group (palette icon) in the CanvasToolbar opens the
  HubBackgroundPicker for the active hub — reachable directly from Canvas, not only via the Hub Inspector Visual tab.
  Added as a new DockGroupKey matching the existing pattern + per-item useChromeSlab; the P2a drag-spine / GSAP
  collapse-expand code and other tool groups untouched.
- **C31 apply path:** unchanged live `updateHub({background})` (additive schema; HubBackgroundStack reads it live every
  frame → no separate Build). Hub Inspector entry preserved byte-identical (no regression).

(Live verify steps: open the Background group from the Canvas dock → picker shows 5 cards each with a preview swatch →
apply a preset to the active hub → background changes live.)
