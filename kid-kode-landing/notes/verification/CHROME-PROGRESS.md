# CHROME OVERHAUL — RUN 1 ledger

Target = Awwwards/WOW premium 2D chrome over the WebGPU scene. Branch `prism-editor-build`.
Bar: "competent Tailwind / clean flat UI" == FAIL. Heuristic: if it feels like "enough", it isn't.

| Wave | Scope | Status | Evidence |
|---|---|---|---|
| W1 | Typography (Switzer) + OKLCH tokens + 8pt grid | DONE (10:21:49) | Switzer renders (width 703 ≠ serif 639/sans 679), tier t2, tracking applied, brass richer, tsc 0-new, 0 console err. notes/verification/chrome/w1/ |
| W2 | Refraction glass — toolbar + inspector (lit resting state) | DONE | Slab shader: guaranteed lit smoked-glass floor + baked key sheen + stronger Fresnel rim + wider chromatic split; panels read as lit material not void (notes/verification/chrome/w2/). tsc 0-new, 0 console err |
| W3 | True-3D hero controls + glass-DOM secondary buttons | DONE | Primary "Add Node" → TRUE-3D brass hero key (real beveled ExtrudeGeometry, cursor-tilt + pointer-light specular + physics press) matching the already-shipped mode-toggle thumb + hub-switcher active slot. Secondary Reset/Search → scene-sampling glass (frost 0.45). Light brass label (textShadow) over the lit cap for legibility — same pattern as the mode-toggle labels (dark-ink failed: cap reads graphite at rest). Verified live t2: 3 brass heroes registered (mode-thumb, add-node, hub-active), hover bloom proves real bevel specular, 39 slabs, 0 console err, tsc 0-new (9 baseline). notes/verification/chrome/w3/ |
| W4 | Micro-interactions | — | — |
| W5 | Performance + tier-gating (measured) | — | — |
| W6 | Verification gate + sign-off | — | — |
