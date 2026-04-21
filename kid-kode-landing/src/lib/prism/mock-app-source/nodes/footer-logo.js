// Prism node: footer-logo — lift-hover + tap emits 'navigate' home.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, transform, events, intent } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const sprite = new PIXI.Sprite(atlas.getTexture(region));
  sprite.anchor.set(0.5);
  sprite.x = transform.width / 2;
  sprite.y = transform.height / 2;
  sprite.width = transform.width;
  sprite.height = transform.height;
  container.addChild(sprite);

  container.on('pointerover', () => gsap.to(sprite, { y: transform.height / 2 - 2, duration: 0.18, ease: 'power2.out' }));
  container.on('pointerout',  () => gsap.to(sprite, { y: transform.height / 2,     duration: 0.18 }));
  container.on('pointertap',  () => events.emit('navigate', { source: intent.nodeId, target: 'home' }));

  return { container, teardown: () => container.destroy({ children: true }) };
}
