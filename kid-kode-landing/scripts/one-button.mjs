import { fal } from "@fal-ai/client";
import { writeFileSync } from "node:fs";
fal.config({ credentials: process.env.FAL_KEY });

const prompt = `Ultra-detailed close-up photograph of a premium rounded pill-shaped button for a dark mode interface. The button is a single physical object floating against pure black. Its surface is blown glass filled with a deep electric-cobalt-blue to violet-purple gradient caught under cinematic studio lighting. Visible texture on the glass: faint fingerprint smudge at upper-right, tiny dust motes drifting above the surface, a warm amber rim light catching the top edge, subtle caustic refraction in the glass material, deep internal volumetric glow radiating outward from within the glass itself. Macro photograph aesthetic with shallow depth of field from 85mm lens, crisp pill silhouette, transparent background outside the pill shape. Clean white Inter bold text "Get Started" etched into the glass surface with shallow relief. Absolutely photorealistic, hyperreal material detail, glossy refraction, caustic light bending. Not a flat UI render. Not a gradient rectangle. A photograph of a glass object.`;

const result = await fal.subscribe("fal-ai/flux-2-pro", {
  input: { prompt, image_size: { width: 1024, height: 384 } },
  logs: false,
});
const url = result?.data?.images?.[0]?.url;
console.log("url:", url);
const res = await fetch(url);
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync("notes/mockup-candidates/one-button.png", buf);
console.log("saved notes/mockup-candidates/one-button.png");
