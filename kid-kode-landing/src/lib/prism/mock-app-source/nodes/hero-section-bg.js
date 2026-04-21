// Prism node: hero-section-bg — i2v frame-cycle (mock spec §3.4.3 verbatim,
// ctx-injected). 24 fps, seamless loop.
export function createNode(ctx) {
  const { PIXI, atlas, frameRegions, transform, intent } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);

  const sprites = (frameRegions ?? []).map((r) => {
    const s = new PIXI.Sprite(atlas.getTexture(r));
    s.width = transform.width;
    s.height = transform.height;
    s.visible = false;
    container.addChild(s);
    return s;
  });

  if (sprites.length === 0) {
    // Graceful degrade: no frames yet. Single static placeholder (no forbidden APIs).
    return { container, teardown: () => container.destroy({ children: true }) };
  }

  let cur = 0;
  sprites[0].visible = true;
  const fps = intent.visualSpec?.animationSpec?.fps ?? 24;
  const tick = 1000 / fps;
  const id = setInterval(() => {
    sprites[cur].visible = false;
    cur = (cur + 1) % sprites.length;
    sprites[cur].visible = true;
  }, tick);

  return {
    container,
    teardown() {
      clearInterval(id);
      container.destroy({ children: true });
    },
  };
}
