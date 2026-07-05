# fal.ai Model Verification — June 2026 (live-web verified)

All model IDs and prices below were verified against live fal.ai model pages on June 11, 2026.

## Summary table

| Category | PRIMARY | Price | Fallback | Price |
|---|---|---|---|---|
| Hi-res T2I (photoreal) | `fal-ai/flux-2-pro` (4MP native) | $0.03 first MP + $0.015/extra MP (~$0.075 @ 4MP) | `fal-ai/bytedance/seedream/v4.5/text-to-image` | $0.04/image (≤4MP, 1920–4096px/dim) |
| Image EDIT (refine) | `fal-ai/flux-2-pro/edit` (multi-ref ≤10 imgs, 4MP) | $0.03 + $0.015/extra MP | `fal-ai/nano-banana-pro/edit` (Gemini 3 Pro Image) | $0.15/image; $0.30 @ 4K |
| 1-image → textured 3D | `fal-ai/hunyuan3d-v3/image-to-3d` (GLB+OBJ, PBR) | $0.375 base; +$0.15 PBR; +$0.15 multi-view; geometry-only $0.225 | `fal-ai/trellis-2` (GLB) | $0.25 (512p) / $0.30 (1024p) / $0.35 (1536p) |
| Text → 3D | `fal-ai/hunyuan-3d/v3.1/pro/text-to-3d` (40K–1.5M faces) | $0.375 (+$0.15 PBR) | `fal-ai/hunyuan-3d/v3.1/rapid/text-to-3d` | $0.225 |
| Loop video textures (I2V) | `fal-ai/kling-video/v3/pro/image-to-video` (`end_image_url` → seamless loop) | $0.112/s no-audio (≤15s) | `fal-ai/veo3.1/fast/first-last-frame-to-video` | $0.10/s no-audio (720/1080p) |
| Cheap 4K video | `fal-ai/ltx-2/image-to-video` (LTX 2.0 Pro) | $0.06/s 1080p, $0.12/s 1440p, $0.24/s 4K | `fal-ai/ltx-2.3/image-to-video/fast` | $0.06/s 1080p, $0.24/s 4K |
| PBR materials | `fal-ai/patina/material` (5 maps, tileable, ≤8K) | $0.01 + $0.02/MP + $0.01/MP per map; upscale +$0.004(2x)/$0.016(4x) per MP/map | — (only dedicated PBR model on fal) | — |
| Env/360 world (HDRI-ish) | `fal-ai/hunyuan_world/image-to-world` (explorable 360-panorama world) | $0.30/generation | Equirect prompting via `fal-ai/flux-2-pro` / Seedream | per-MP / $0.03–0.04 |

## 1. Hi-res image gen (2K–4K photoreal)

FLUX.1 (incl. 1.1 Ultra) is superseded — **FLUX.2 (Black Forest Labs) is current**, all variants on fal, all up to **4MP (4K-class) native output**:
- `fal-ai/flux-2-pro` — **$0.03 first MP + $0.015/extra MP** (4MP/2048x2048 ≈ $0.075). Zero-config studio-grade photorealism; fal's own top photoreal pick in their 2026 roundup. JSON prompting + HEX color control.
- `fal-ai/flux-2` (dev, 32B) — $0.012/MP for cheap iteration; `fal-ai/flux-2-flex` — $0.05/MP (parameter control); `fal-ai/flux-2-max` — $0.07/MP (top tier); `fal-ai/flux-2-lora-gallery/realism` — $0.021/image photoreal LoRA preset.
- **Highest pixel dimensions:** `fal-ai/bytedance/seedream/v4/text-to-image` accepts custom sizes up to **4096x4096** at **$0.03/image** — cheapest path to literal 4K-wide frames. Newer `.../v4.5/text-to-image` ($0.04, 1920–4096px per dimension, ≤4MP total) is a unified gen+edit model. `fal-ai/imagen4/preview/ultra` — $0.06/image, photoreal but lower max res.

**Edit/refine:** `fal-ai/flux-2-pro/edit` — same per-MP pricing, ≤10 reference images, 4MP out (best value). Quality leader for complex semantic edits: `fal-ai/nano-banana-pro/edit` (Gemini 3 Pro Image) — **$0.15/image, $0.30 at 4K**, ≤14 refs — use sparingly on $50. Budget editor: Seedream v4.5 edit at $0.04.

## 2. Prompt/single-image → complete 3D object

Confirmed: the new single-pass generators lead; multi-view stitching is legacy.
- **PRIMARY — Hunyuan3D v3 / v3.1 (Tencent):**
  - `fal-ai/hunyuan3d-v3/image-to-3d` — **$0.375 base** ($0.225 geometry-only, $0.45 low-poly; **+$0.15 PBR**, +$0.15 multi-view, +$0.15 custom face count). **GLB + OBJ**, up to **1.5M polys**, PBR (metallic/roughness/normal). Best quality reputation of the June-2026 crop.
  - v3.1: `fal-ai/hunyuan-3d/v3.1/pro/{text-to-3d,image-to-3d}` — **$0.375** (1,024-char prompts, 40K–1.5M faces, ≤8 view angles); `fal-ai/hunyuan-3d/v3.1/rapid/{text-to-3d,image-to-3d}` — **$0.225** (single view, fixed polys, seconds-fast).
- **Fallback — `fal-ai/trellis-2`** (Microsoft TRELLIS.2): **$0.25 / $0.30 / $0.35** at 512p/1024p/1536p texture res, GLB, PBR-capable, 20s–4min.
- Also live: `fal-ai/hyper3d/rodin` (Rodin Gen-2, 10B DiT) — **$0.40/gen**, full auto PBR (albedo/roughness/metallic/normal), strongest topology, priciest. TripoSR draft tier at $0.07.

## 3. Video gen (short seamless-loop textures)

- **PRIMARY — Kling v3 Pro:** `fal-ai/kling-video/v3/pro/image-to-video` — **$0.112/s** audio-off ($0.168 audio-on), ≤15s, supports **`end_image_url`** (set end frame = start frame for a seamless loop). Budget sibling Kling 2.5 Turbo Pro still listed at **$0.07/s**.
- **Fallback (purpose-built for loops) — Veo 3.1 first-last-frame:** `fal-ai/veo3.1/fast/first-last-frame-to-video` — **$0.10/s** no-audio (720/1080p); standard FLF $0.20/s; `veo3.1/lite` $0.05/s 720p / $0.08/s 1080p.
- **Cheapest 4K:** `fal-ai/ltx-2/image-to-video` (LTX 2.0 Pro) — **$0.06/s 1080p / $0.12/s 1440p / $0.24/s 2160p**; `.../fast` $0.04/s 1080p. Newer `fal-ai/ltx-2.3/image-to-video` $0.08/s 1080p ($0.06 fast). Wan 2.2/2.7 exist on fal but Kling/Veo/LTX dominate 2026 comparisons.
- Cost check: 5s 1080p loop ≈ $0.56 (Kling v3 Pro), $0.50 (Veo 3.1 Fast FLF), $0.30 (LTX-2 Pro).

## 4. HDRI / environment / PBR materials

- **PBR materials — `fal-ai/patina/material`** (fal first-party): seamlessly-tiling basecolor + normal + roughness + metalness + height (+ combined preview) from text or image; native ≤2048px, upscale to **8K**; configurable tiling modes. **$0.01 base + $0.02/MP + $0.01/MP per map**; upscale +$0.004/MP/map (2x) or +$0.016/MP/map (4x). A 2K 5-map material ≈ $0.30–0.40. Free gallery of 731 Patina materials at pbr.directory.
- **Environment/360 — `fal-ai/hunyuan_world/image-to-world`** (HunyuanWorld 1.0): **$0.30/gen**, single image → explorable equirectangular-panorama-based 3D world (world file, optional DRC). Note: LDR output, not true 32-bit HDR — fal has no dedicated HDRI model; for env-maps, generate an equirectangular panorama with FLUX.2 [pro] or Seedream (equirect prompting) and convert, or use HunyuanWorld's panorama.

## $50-budget intuition
~$0.075 per 4MP FLUX.2 [pro] frame, ~$0.525 per PBR-textured Hunyuan3D v3 mesh, ~$0.56 per 5s Kling v3 loop, ~$0.35 per 2K Patina material → roughly 40 hero images + 20 3D objects + 10 loops + 10 materials ≈ $30, leaving headroom for retries.

Sources: [FLUX.2 pro](https://fal.ai/models/fal-ai/flux-2-pro) · [FLUX.2 on fal blog](https://blog.fal.ai/flux-2-is-now-available-on-fal/) · [fal FLUX.2 hub](https://fal.ai/flux-2) · [FLUX 2 LoRA Realism](https://fal.ai/models/fal-ai/flux-2-lora-gallery/realism) · [Seedream v4.5 T2I](https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/text-to-image) · [Seedream v4 T2I](https://fal.ai/models/fal-ai/bytedance/seedream/v4/text-to-image) · [Seedream 4.0 blog](https://blog.fal.ai/seedream-4-0-on-fal-fast-consistent-4k-ready-image-creation/) · [Imagen 4 Ultra](https://fal.ai/models/fal-ai/imagen4/preview/ultra) · [Nano Banana Pro](https://fal.ai/models/fal-ai/nano-banana-pro) · [Nano Banana Pro edit](https://fal.ai/models/fal-ai/nano-banana-pro/edit) · [FLUX.2 pro edit](https://fal.ai/models/fal-ai/flux-2-pro/edit) · [Hunyuan3D v3 image-to-3d](https://fal.ai/models/fal-ai/hunyuan3d-v3/image-to-3d) · [Hunyuan 3D v3.1 rapid T23D](https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/rapid/text-to-3d) · [Hunyuan 3D v3.1 pro T23D](https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/pro/text-to-3d) · [fal Hunyuan 3D hub](https://fal.ai/hunyuan-3d) · [Trellis 2](https://fal.ai/models/fal-ai/trellis-2) · [Hyper3D Rodin](https://fal.ai/models/fal-ai/hyper3d/rodin) · [Kling v3 pro I2V](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video) · [fal Kling 3.0 hub](https://fal.ai/kling-3) · [Veo 3.1 fast I2V](https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video) · [Veo 3.1 fast FLF](https://fal.ai/models/fal-ai/veo3.1/fast/first-last-frame-to-video) · [Veo 3.1 lite FLF](https://fal.ai/models/fal-ai/veo3.1/lite/first-last-frame-to-video) · [LTX-2 I2V Pro](https://fal.ai/models/fal-ai/ltx-2/image-to-video) · [LTX-2.3 I2V](https://fal.ai/models/fal-ai/ltx-2.3/image-to-video) · [fal I2V roundup 2026](https://fal.ai/learn/tools/ai-image-to-video-generators) · [fal image-gen roundup 2026](https://fal.ai/learn/tools/ai-image-generators) · [PATINA material](https://fal.ai/models/fal-ai/patina/material) · [pbr.directory (Patina library)](https://pbr.directory/) · [HunyuanWorld image-to-world](https://fal.ai/models/fal-ai/hunyuan_world/image-to-world) · [fal pricing](https://fal.ai/pricing)