import { fal } from '@fal-ai/client';
if (!process.env.FAL_KEY) { console.error('NO FAL_KEY'); process.exit(1); }
fal.config({ credentials: process.env.FAL_KEY });
const t = Date.now();
try {
  const r = await fal.subscribe('fal-ai/flux-2', {
    input: { prompt: 'a single smooth brass sphere centered on pure black, studio product render, sharp, no text no letters', image_size: { width: 512, height: 512 }, num_images: 1 },
    logs: false,
  });
  console.log(JSON.stringify({
    ok: true, ms: Date.now() - t, requestId: r.requestId,
    dataKeys: Object.keys(r.data || {}),
    imgUrl: r.data?.images?.[0]?.url, imgW: r.data?.images?.[0]?.width, imgH: r.data?.images?.[0]?.height,
  }, null, 2));
} catch (e) {
  console.log(JSON.stringify({ ok: false, ms: Date.now() - t, err: String(e?.message || e), status: e?.status, body: e?.body }, null, 2));
}
