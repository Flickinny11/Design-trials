// W-DG1: register the generated exemplars into their family JSON exemplars[].
// I-PROVENANCE: generator/model/mode state the REAL source (Replicate flux-2-pro,
// live spend). Idempotent — rewrites the exemplars array to this single entry.
import fs from "node:fs";
import path from "node:path";

const dir = "design-grammar/families";
const reg = {
  "layered-photo-parallax-hero":
    "Matte-black cold-brew bottle levitating on a detached soft shadow, warm amber neon rim glow keying it to a single hue on near-black, a swarm of coffee beans + cardamom pods drifting at varied scale/blur through atmospheric haze — our own product/hue, distinct from any analyzed source.",
  "cinematic-video-hero":
    "Lone hooded silhouette on a rain-slick night street, anamorphic neon bokeh, teal-orange cinematic grade, volumetric haze — original film-still composition of the family dark cinematic register.",
  "editorial-product-gallery":
    "Single faceted crystal perfume bottle on a seamless warm-grey sweep, one soft overhead key, thin ground shadow, vast negative space — museum-label editorial minimalism.",
  "glitch-cyber-fx":
    "Neon-noir portrait half-lit magenta/cyan on black with a faint RGB channel-split ghost, scanline texture, and one acid-yellow accent shape — corrupt-the-image/keep-the-UI aesthetic as a still.",
  "hover-morph-distortion":
    "High-key airy fashion subject cutout on a pale sky backdrop with a giant flat coral shape behind, soft daylight, one loud accent hue — the stable-anchor-plus-clean-plane setup the liquid warp plays against.",
  "particle-field-hero":
    "Thousands of fine points converging into a soft luminous nucleus with link-lines, single cyan-to-violet gradient on deep space black — emergent-order particle field.",
  "gpu-fluid-overlay":
    "Viscous oily ink folding across a dark field with thin-film soap-bubble iridescence through magenta/teal/gold — the iridescent fluid-bloom look.",
  "parallax-zoom-deep-dive":
    "Layered deep-space scene: near rocky arch framing a mid nebula and far starfield, warm-core/cool-edge light — the dolly-through depth stack.",
  "oversized-type-editorial":
    "A single enormous serif word breaking the grid over bone-white space with a monochrome portrait interleaved through the letterforms and one vermilion accent rule — editorial scale-contrast + type-as-depth-plane.",
  "bento-grid-slider":
    "Mixed-size rounded tiles with uniform gutters on a warm off-white canvas — a large travel-photo feature tile beside a soft 3D gradient orb, a muted map, and a stat card — the bento layout language as a still.",
  "coverflow-3d-carousel":
    "Five glossy rounded cards fanned on a curved arc in perspective, center card upright and sharp, side cards tilted/receding with depth blur, reflections on a dark glass floor with soft contact shadows — the coverflow depth read.",
};

let n = 0;
for (const [id, promptSummary] of Object.entries(reg)) {
  const p = path.join(dir, `${id}.json`);
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  d.exemplars = [
    {
      path: `design-grammar/exemplars/${id}-01.webp`,
      generator: "replicate",
      model: "flux-2-pro",
      mode: "live",
      promptSummary,
      generatedAt: "2026-07-06",
      notes:
        "ORIGINAL render (Replicate black-forest-labs/flux-2-pro, ~$0.06). Subject deliberately distinct from any analyzed source template. Illustrates the family aesthetic target (palette/composition/lighting); does NOT demonstrate runtime motion or in-engine execution.",
    },
  ];
  fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
  n++;
}
console.log(`patched ${n} families with exemplars`);
