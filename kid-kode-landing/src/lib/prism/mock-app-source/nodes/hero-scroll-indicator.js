// Prism node: hero-scroll-indicator — gentle infinite bounce; tap fires
// scroll-to event consumed by the page scroller.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, transform, events, intent } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const sprite = new PIXI.Sprite(atlas.getTexture(region));
  sprite.width = transform.width;
  sprite.height = transform.height;
  sprite.alpha = 0.7;
  container.addChild(sprite);

  // Idle bounce.
  gsap.to(sprite, { y: 6, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' });

  container.on('pointerover', () => gsap.to(sprite, { alpha: 1.0, duration: 0.2 }));
  container.on('pointerout',  () => gsap.to(sprite, { alpha: 0.7, duration: 0.2 }));
  container.on('pointertap',  () => events.emit('scroll-to', { source: intent.nodeId, target: 'feature-card-ai' }));

  return { container, teardown: () => container.destroy({ children: true }) };
}
