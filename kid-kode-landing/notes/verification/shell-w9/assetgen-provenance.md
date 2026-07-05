# W9 asset-generation provenance (founder audit discharge — addendum 2026-07-05 13:50)

No key material appears in this file, in git, or in any log (INV-19).

## Audit finding: TRUE provenance of commit `d79b2214` (2026-07-05 13:39:59)

The four PBR sets in that commit **were real Replicate FLUX generations**, not
locally-synthesized impostors. Evidence (queried live from the Replicate
predictions API, 2026-07-05 ~13:54 local):

| created_at (UTC) | model | status |
|---|---|---|
| 2026-07-05T18:38:20.127Z | black-forest-labs/flux-2-pro | succeeded |
| 2026-07-05T18:38:29.890Z | black-forest-labs/flux-2-pro | succeeded |
| 2026-07-05T18:38:38.170Z | black-forest-labs/flux-2-pro | succeeded |
| 2026-07-05T18:38:46.843Z | black-forest-labs/flux-2-pro | succeeded |

18:38 UTC = 13:38 local — matching the source-plate mtimes in
`Design-trials/.assetgen/out/generated/{onyx-guilloche,nero-marquina,noir-leather,anodized-graphite}.png`
(all Jul 5 13:38) and preceding the 13:39:59 commit. The pipeline that ran is
`Design-trials/.assetgen/gen-material.sh` → `gen-flux.py` (flux-2-pro, 1 MP) →
`derive-material-pbr.mjs` (matched-latent + delit PBR derivation), authored
2026-06-22..26 during the material-lab wave; the root `.assetgen/replicate.key`
has existed since 2026-06-22.

**What was false in the commit message:** the word "committed" — `.assetgen/`
is gitignored, so the pipeline is real but NOT committed. (The message echoed
the same inaccurate phrase that pre-exists in `src/app/api/material-gen/route.ts`
and `gen-material.sh` comments.) The audit premise "no pipeline script existed
anywhere on disk and no Replicate key was present before 13:46" did not hold:
the 13:46 keys were added to `kid-kode-landing/.assetgen/` (which the route does
NOT read — it resolves `path.resolve(process.cwd(), '..', '.assetgen')`, the
root), while the root pipeline + key predate the run by two weeks.

The original 13:38 source plates are preserved at
`Design-trials/.assetgen/out/generated/archive-w9-original/` (forensic copy,
gitignored); the original PBR sets remain retrievable at `d79b2214`.

## Regeneration per the addendum (2026-07-05 13:56–13:57 local)

All four sets regenerated through the same real pipeline, replacing the
committed maps under `public/prism-mock/editor/textures/generated/<id>/`
(albedo/normal/rough/metal/ao, 768×768). Full raw log:
`assetgen-regen-w9.log` (this directory).

| id | kind | seed | Replicate prediction id | plate bytes |
|---|---|---|---|---|
| onyx-guilloche | metal | 41 | `2eefwce245rmy0cz6ehrj5qgtg` | 1,977,487 |
| nero-marquina | stone | 42 | `kthgyvq5knrmw0cz6ehr1sccfg` | 1,308,157 |
| noir-leather | fabric | 43 | `t50hrfgb8drmy0cz6ej9t73adc` | 2,274,325 |
| anodized-graphite | metal | 44 | `qezbxeheehrmr0cz6ej8h8xp0w` | 1,921,119 |

## Spend tracking (running, W9)

- flux-2-pro, 1 MP, est. ≈ $0.06/image (estimate; see report for the running total).
- 13:38 batch (resume #1): 4 images ≈ $0.24.
- 13:56 regeneration batch (this discharge): 4 images ≈ $0.24.
- Running W9 Replicate estimate: ≈ $0.48 of the ~$8 cap.
- Tripo: 0 credits used so far (balance check pending before any batch use).
