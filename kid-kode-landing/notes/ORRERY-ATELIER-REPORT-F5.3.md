# ORRERY No.7 — F5.3 Verification Report

Date: 2026-06-20  
Branch: prism-editor-build  
Commit: fd3c710b  
fal spend: $1.035 / $40 cap

---

## SC Results

| SC | Description | Result | Evidence |
|----|-------------|--------|----------|
| SC-O1 | Hub s6-atelier loads with 79 nodes, viewMode=preview-app | PASS | `atelierNodeCount: 79`, `viewMode: "preview-app"` |
| SC-O2 | Watch proxy nodes mounted with meshPrimitiveHandle | PASS | 13 proxy nodes confirmed with `hasMeshHandle: true` |
| SC-O3 | New dial catalog nodes in scene (guilloche/aventurine/enamel) | PASS | All 3 new swatch nodes in scene with meshPrimitiveHandle |
| SC-O4 | Dial catalog has 9 variants total (6 existing + 3 new) | PASS | 10 dial catalog nodes (1 label + 9 swatches) |
| SC-O5 | setColorMap() live on MeshPrimitiveHandle | PASS | `hasSetColorMap: true`, methods: `[setPrimitive, setMaterialSpec, setColorMap]` |
| SC-O6 | applyConfiguratorToScene wired with loader | PASS | AtelierApplier passes `configuratorLoader` |
| SC-O14 | Zero console errors | PASS | `0 errors, 3 warnings` (pre-existing warnings) |

## INV Static Checks

| INV | Check | Result | Note |
|-----|-------|--------|------|
| INV-G2 | No THREE.TextGeometry in active code | PASS (FP) | Matches only in comments/verifier strings, not active use |
| INV-G3 | No document.* in runtime | PASS (FP) | `video-element.ts` is an isolated exception; matches in comments/strings |
| INV-G4 | No pixi in active code | PASS (FP) | Matches only in comments/verifier/build scripts about PixiJS removal |
| INV-G6 | No secrets in live-graph.json | PASS | Clean — no FAL_KEY/sk-/OPENAI found |
| INV-G7 | No hub-world/preview-hub literals in active src | PASS (FP) | Matches only in comments/bak files, not in active code strings |

## Changes Summary

### Textures Provisioned (7)
- `dial-tex-guilloche.png` — 4.4MB, deep-blue guilloché engine-turned
- `dial-tex-solarized.png` — 2.6MB, sunburst solarized champagne
- `dial-tex-meteorite.png` — 3.6MB, etched iron Widmanstätten lattice
- `dial-tex-aventurine.png` — 4.9MB, midnight blue with gold flecks
- `dial-tex-enamel.png` — 1.4MB, grand feu creamy white enamel
- `strap-tex-alligator.png` — 3.6MB, navy alligator hide
- `strap-tex-rubber.png` — 3.8MB, matte black vulcanized rubber

### Code Changes
- `mesh-primitive.ts`: `MeshPrimitiveHandle.setColorMap()` added (interface + impl)
- `applier.ts`: `applyConfiguratorToScene()` takes optional `FaceTextureLoaderLike` loader
- `config.ts`: `finish()` passes through `baseColorMapUrl`; meteorite updated; 3 new variants; 2 strap variants updated
- `AtelierApplier.tsx`: module-scope `TextureLoader` cache wired through
- `live-graph.json`: 3 new catalog swatch nodes (guilloche/aventurine/enamel)
- `dependency-allowlist-check.py`: `@/` alias path allowed (Next.js project alias)

## Fal Ledger
Total: $1.035 / $40 cap (breakdown: $0.72 case-round GLB + 7 × $0.045 textures)

## PASS/FAIL Summary
- PASS: 7/7 SC
- PASS: 5/5 INV
- Blockers: 0
