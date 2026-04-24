# source-videos/

Playable MP4 content for the 4 `video-slot-{1..4}` nodes in `home-hub.json`.

Each MP4 is referenced from
`intent.behaviorSpec.interactions[0].src = "source-videos/video-slot-N.mp4"`
on the matching graph node (wired by **T-VID-01**). The runtime module at
`src/lib/prism/mock-app-source/nodes/video-slot.js` plays the clip on
`pointertap`.

This directory is **not** part of the atlas pipeline. The `.prism` build
(`npm run build:prism`) does not copy, hash, or validate these files — per
the §-SPEC-ENRICH downstream invariant that `src` is data, not a reference
to a packed region (see `notes/prism-spec-extract.md:1357`).

---

## Two ways to populate this directory

T-VID-03 intentionally requires a decision. Pick one — the defaults favor
**(A)**, the zero-cost user-supplied path.

### (A) User-supplied content (recommended, zero cost)

Drop MP4 files named exactly:

- `video-slot-1.mp4`
- `video-slot-2.mp4`
- `video-slot-3.mp4`
- `video-slot-4.mp4`

Then re-run `npm run build:prism`. No FAL call is made.

Suggested content: short looping clips (≤10s) that match the AETHER
aesthetic of the mockup — dark, obsidian, minimal. Frame aspect is free
but visual-slot transform is 430×260 (16:9 roughly), so content authored
near that ratio will crop cleanly.

### (B) Auto-generate placeholders (opt-in, $2.00 ceiling)

The script at `scripts/generate-placeholder-videos.mjs` calls
`fal-ai/wan/v2.7/image-to-video` once per slot, conditioned on the
per-slot mockup crop from `source-images/cropped/video-slot-{N}.png`.

- Per clip: **$0.50**
- Total ceiling: **$2.00** (4 × $0.50)
- Model: `fal-ai/wan/v2.7/image-to-video` (see CLAUDE.md §5 Model IDs)

To opt in, run with an explicit environment flag:

```sh
PRISM_CONFIRM_VIDEO_GENERATION=1 \
  node --env-file=.env.local scripts/generate-placeholder-videos.mjs
```

Without the env var the script refuses and exits non-zero — this is
the audit gate that prevents an accidental untended charge.

Any individual slot whose MP4 already exists on disk is skipped, so a
partial mix of (A) user-supplied + (B) auto-generated is supported.

---

## Why this file exists

`notes/ralph-state.json` → task `T-VID-03` instructs the Ralph loop to
*prompt the user first via a status commit* before firing any paid API
call. This README is that prompt, committed alongside the gated script so
the user has a fixed artifact to read and respond to instead of a
transient commit message.

See also:

- `notes/prism-spec-extract.md:1312` — §-SPEC-ENRICH classifier design note
- `src/lib/prism/mock-app-source/hubs/home-hub.json` — `video-slot-1..4`
  entries (search: `"nodeId": "video-slot-`)
- `src/lib/prism/mock-app-source/nodes/video-slot.js` — runtime module
- `scripts/generate-placeholder-videos.mjs` — the gated auto-generation
  script
