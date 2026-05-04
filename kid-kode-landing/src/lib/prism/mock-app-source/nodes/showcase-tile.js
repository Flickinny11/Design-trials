// Prism node: showcase-tile-{1..4} — i2v keyframe loop (method 3) of a
// stylized mini-scene inside the holographic tile. Lift-hover; tap emits
// play-preview to open an expanded preview modal.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, regionKeys, transform, events, intent } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const frames = Array.isArray(regionKeys) && regionKeys.length > 0 ? regionKeys : [region];
  const fps = intent?.visualSpec?.animationSpec?.fps ?? 24;
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

  const baseY = transform.y;
  container.on('pointerover', () => gsap.to(container.position, { y: baseY - 4, duration: 0.25, ease: 'power2.out' }));
  container.on('pointerout',  () => gsap.to(container.position, { y: baseY,     duration: 0.25 }));
  container.on('pointertap',  () => events.emit('play-preview', { source: intent.nodeId }));

  return {
    container,
    teardown: () => {
      ticker?.remove?.(tick);
      container.destroy({ children: true });
    },
  };
}
