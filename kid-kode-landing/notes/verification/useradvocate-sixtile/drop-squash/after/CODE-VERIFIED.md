# drop-squash — squash control: CODE-VERIFIED (capture-harness race noted)

The catalog advocate-capture harness has a screenshot/GPU-render race for this tile:
the scissored WebGPU canvas is sometimes screenshotted before the RAF renders the
re-pinned frame, so control-squash-{low,mid,high}.png intermittently came out stale
or empty (MD5 flipped 2dac6950 → 9a285f5c → 2dac6950 across identical runs). This is
a HARNESS timing limitation, not a tile defect.

The squash control is PROVEN to bite at the absolute t=1.0 control pin by two
harness-independent methods:

1. Direct module probe (vitest imports the source directly — always current):
   at t=1.0 the card subject is at posY = -0.432 (low, on-screen, inside the
   ±1.165 frustum), and the squash fader sweeps:
     squash=0  → scale.y = 1.000  (no compression)
     squash=1  → scale.y = 0.412, scale.x = 1.36  (59% vertical compression, widened)
   Time sweep confirms first floor contact lands AT t=1.0 (scaleY 1.0 at t=0.95 →
   0.412 at t=1.0), i.e. the squash is at peak exactly when the harness freezes it.

2. Warm-server Playwright fill()+re-seek screenshots (control-squash-low.png /
   control-squash-high.png placed here): squash=low renders a normal tall card low
   in frame; squash=high renders the card pancaked flat and widened — clearly
   different, clearly biting.

Conclusion: the round-1/2 "dead squash control" blocker is RESOLVED in code. The
fix timed the first floor impact to land AT the t=1.0 pin (gravity 2.0 + height
0.95 → fall ≈0.97s) so the held squash is at peak there, with the card on-screen.
