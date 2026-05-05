// Prism node: hero-portal-frame — i2v keyframe loop (method 3) of the nebula
// inside the bronze portal frame. Frame textures are pre-baked into the atlas
// (one region per frame). Idle pulse scales the whole portal subtly.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, regionKeys, transform, events, intent } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const frames = Array.isArray(regionKeys) && regionKeys.length > 0 ? regionKeys : [region];
  const fps = intent?.visualSpec?.animationSpec?.fps ?? 30;
  const frameDuration = 1 / fps;

  const sprite = new PIXI.Sprite(atlas.getTexture(frames[0]));
  sprite.width = transform.width;
  sprite.height = transform.height;
  container.addChild(sprite);

  let frameIndex = 0;
  let elapsed = 0;
  const tick = (delta) => {
    elapsed += delta / 60;
    if (elapsed >= frameDuration) {
      elapsed = 0;
      frameIndex = (frameIndex + 1) % frames.length;
      sprite.texture = atlas.getTexture(frames[frameIndex]);
    }
  };
  const ticker = PIXI.Ticker?.shared;
  ticker?.add?.(tick);

  // Idle pulse on the whole container — gentle breathe.
  gsap.to(container.scale, { x: 1.015, y: 1.015, duration: 4, repeat: -1, yoyo: true, ease: 'sine.inOut' });

  container.on('pointertap', () => events.emit('navigate', { source: intent.nodeId, target: 'home' }));

  return {
    container,
    teardown: () => {
      ticker?.remove?.(tick);
      container.destroy({ children: true });
    },
  };
}
