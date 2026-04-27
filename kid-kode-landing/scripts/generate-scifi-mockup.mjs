import { fal } from "@fal-ai/client";
import { writeFileSync } from "node:fs";
fal.config({ credentials: process.env.FAL_KEY });

const prompt = `A stunning sci-fi futuristic 3D interface composition, portrait vertical scroll layout, rendered as photorealistic cinematic concept art. Deep-space cosmic environment with volumetric nebulae, distant galaxies, iridescent aurora, bioluminescent accents, dramatic god-ray lighting, hyperreal depth of field.

Composition from top to bottom:

Top band — horizontal array of five crystalline navigation sigils floating in zero gravity, suspended like ceremonial relics, each a unique carved artifact catching volumetric light. A large ornate brand sigil anchors the left side; a single commanding pill-shaped portal sits on the right, glowing with internal plasma.

Upper mid — a vast monumental observation window or portal frame, centerpiece of the composition, looking into deep space: a swirling nebula, a crescent planet limb, scattered starfields. Inside the portal, atmospheric depth goes for miles. Below the portal floats a single luminous call-to-action orb emitting soft volumetric glow.

Mid — three distinct holographic artifact panels arranged horizontally, each a separate floating monument with its own colored aura: one cobalt-cyan, one violet-amethyst, one rose-amber. Each artifact houses a radiant circular emblem — one an orbital gyroscope, one a tessellated molecular cluster, one a shimmering geometric fractal. Each artifact sits in space with its own dramatic shadow and aura.

Lower mid — a single ornate crystalline counter-relic with a glowing amber core, floating alone.

Below — two ceremonial interactive artifacts side by side — one a long pill-shaped physical switch catching amber inner fire, the other a smaller circular meditation gem.

Bottom band — a cosmic horizon of distant stars, three circular constellation seals hovering above it, and a ceremonial capstone sigil anchoring the left side.

Style: photorealistic 3D cinematic render, Moebius meets Blame! meets Unreal Engine 5, iridescent refraction, volumetric atmosphere, hand-rendered texture, organic material imperfections, painterly bloom, editorial concept art quality. Absolutely NO text, NO letters, NO numbers, NO words, NO wordmarks, NO typography anywhere. Absolutely NO flat UI chrome, NO rounded rectangles that look like CSS, NO glass-morphism clichés, NO gradient buttons. Every element is a physical sculpted object with material, mass, depth, light interaction. Scale is vast and cinematic. Color palette: deep cosmic navy-black background punctuated by cobalt, violet, rose-amber, teal bioluminescent accents. Pure visual composition. High dynamic range, hyperreal.`;

const negative =
  "text, letters, words, numbers, typography, wordmark, label, caption, logo text, CSS, gradient button, rounded rectangle, glass morphism, flat UI, dashboard, figma, mockup chrome, ui screenshot, code rendering, flat design, minimalist UI";

const t0 = Date.now();
const result = await fal.subscribe("fal-ai/flux-2-pro", {
  input: {
    prompt,
    negative_prompt: negative,
    image_size: { width: 1536, height: 2048 },
    num_inference_steps: 40,
    guidance_scale: 4.0,
  },
  logs: false,
});
const url = result?.data?.images?.[0]?.url;
console.log(`[gen] done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${url}`);
const res = await fetch(url);
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync("notes/mockup-candidates/scifi-mockup-v1.png", buf);
console.log(
  `[gen] saved notes/mockup-candidates/scifi-mockup-v1.png (${buf.length} bytes)`,
);
