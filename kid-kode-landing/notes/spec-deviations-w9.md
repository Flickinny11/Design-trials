# W9 spec deviations — recorded BEFORE the code that deviates

- **W9-D1 — Landing lives at `/home`, not `/` (carried from W6-D1).** `/` is the
  I-CANVAS-protected editor prototype and stays byte-untouched. The env-gated
  apex rewrite (`PRISM_SURFACE=marketing` in `next.config.mjs`) serves the
  landing at `/` on a marketing deployment; OFF by default so every existing
  verify script that hits `/` is unaffected.

(Additional deviations appended below as they arise, each BEFORE its code.)
