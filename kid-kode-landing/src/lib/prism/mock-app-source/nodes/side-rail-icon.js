// Prism node: side-rail-{settings,notifications,profile} — generic side-rail
// utility sigil. Lift-hover + scale-press + tap emits 'open-panel' targeting
// the panel/drawer/menu the JSON declares in triggersDownstream.
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
  sprite.alpha = 0.85;
  container.addChild(sprite);

  container.on('pointerover', () => {
    gsap.to(sprite, { alpha: 1.0, duration: 0.18, ease: 'power2.out' });
    gsap.to(sprite, { y: transform.height / 2 - 2, duration: 0.18 });
  });
  container.on('pointerout', () => {
    gsap.to(sprite, { alpha: 0.85, duration: 0.18 });
    gsap.to(sprite, { y: transform.height / 2, duration: 0.18 });
  });
  container.on('pointerdown', () => gsap.to(sprite.scale, { x: 0.94, y: 0.94, duration: 0.08 }));
  container.on('pointerup',   () => gsap.to(sprite.scale, { x: 1.0,  y: 1.0,  duration: 0.12, ease: 'back.out(2)' }));
  container.on('pointertap',  () => events.emit('open-panel', { source: intent.nodeId }));

  return { container, teardown: () => container.destroy({ children: true }) };
}
