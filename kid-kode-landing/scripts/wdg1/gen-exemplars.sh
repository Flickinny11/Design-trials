#!/usr/bin/env bash
# W-DG1 exemplar generator. Generates ORIGINAL exemplar renders (our own
# compositions, never a recreation of a specific source template) via the
# proven root pipeline (.assetgen/gen-flux.py -> black-forest-labs/flux-2-pro).
# Legal doctrine (PLAN §2): each prompt is our own vocabulary illustrating a
# FAMILY's palette/composition/lighting principles, with a subject deliberately
# DIFFERENT from any analyzed source. "no text/letters/watermark" keeps images
# clean and avoids FLUX letterform garble. Contains NO key material.
#
# Usage: bash scripts/wdg1/gen-exemplars.sh
set -u
GEN="$(cd "$(dirname "$0")/../../.." && pwd)/.assetgen/gen-flux.py"
OUT="$(cd "$(dirname "$0")/../.." && pwd)/design-grammar/exemplars"
LOG="$(cd "$(dirname "$0")/../.." && pwd)/notes/verification/shell-wdg1/exemplar-gen.log"
mkdir -p "$OUT" "$(dirname "$LOG")"
NEG=", clean composition, no text, no letters, no words, no watermark, no logo, no signage"

gen () { # family  file  aspect  seed  prompt
  local fam="$1" file="$2" aspect="$3" seed="$4" prompt="$5"
  echo "=== $fam -> $file (seed $seed, $aspect) ===" | tee -a "$LOG"
  python3 "$GEN" "$prompt$NEG" "$OUT/$file" "$aspect" "1 MP" "webp" "$seed" 2>&1 | tee -a "$LOG"
}

echo "## W-DG1 exemplar generation $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"

gen layered-photo-parallax-hero layered-photo-parallax-hero-01.webp "4:5" 71 \
"Editorial product hero: a matte-black artisan cold-brew coffee bottle floating above a soft detached drop shadow on deep near-black, a single warm amber neon rim light silhouetting the bottle, a swarm of roasted coffee beans and cardamom pods drifting around it at varied scale and focus, subtle atmospheric haze between layers, cinematic single-hue lighting, photoreal studio product photography"

gen cinematic-video-hero cinematic-video-hero-01.webp "16:9" 72 \
"Cinematic film-still hero: a lone hooded figure in silhouette on a rain-slick empty city street at night, deep anamorphic bokeh of distant neon, moody teal-and-orange color grade, volumetric fog and lens haze, shallow depth of field, widescreen anamorphic composition, dramatic low-key lighting"

gen editorial-product-gallery editorial-product-gallery-01.webp "3:2" 73 \
"Museum-grade editorial product still: a single faceted crystal-glass perfume bottle centered on a seamless warm-grey studio sweep, one soft overhead key light, a thin crisp ground shadow, vast negative space around the object, refined magazine-spread minimalism, neutral editorial palette, high-end catalog photography"

gen glitch-cyber-fx glitch-cyber-fx-01.webp "3:2" 74 \
"Neon-noir cyber portrait: a subject's face half-lit in magenta and cyan practical light against pure black, a faint RGB channel-split ghost doubling the edges, fine horizontal scanline texture, a single acid-yellow accent shape, high-chroma cyberpunk mood, deep shadow, aggressive tech energy"

gen hover-morph-distortion hover-morph-distortion-01.webp "3:2" 75 \
"High-key airy fashion hero: a crisp confident model cutout against a pale seamless sky-blue backdrop, a giant flat saturated coral geometric shape behind the subject, soft daylight with no hard shadows, clarity over drama, one loud saturated accent hue, clean graphic minimalism, bright editorial photography"

gen particle-field-hero particle-field-hero-01.webp "16:9" 76 \
"Abstract generative particle constellation: thousands of fine glowing points converging into a soft luminous nucleus with delicate connecting link-lines, a single cyan-to-violet gradient across deep space black, emergent order from scattered dust, subtle depth blur on distant particles, ethereal futuristic hero background"

gen gpu-fluid-overlay gpu-fluid-overlay-01.webp "16:9" 77 \
"Abstract iridescent fluid bloom: viscous oily ink swirling and folding across a dark field, thin-film soap-bubble iridescence shifting through magenta, teal and gold, organic marbled turbulence, smooth continuous flow, high-detail macro liquid, luminous dark-field composition"

gen parallax-zoom-deep-dive parallax-zoom-deep-dive-01.webp "16:9" 78 \
"Deep-space dolly-through scene in layered depth: a dark near rocky arch framing the foreground, a glowing mid-distance nebula, and a far dense starfield beyond, warm amber core light fading to cool blue edges, strong atmospheric layering, cinematic cosmic vista, sense of flying inward"

echo "## done $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"
echo "ALL-DONE" | tee -a "$LOG"
