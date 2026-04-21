// Prism node: footer-link-{privacy,terms,contact} — 2-state layer-swap
// (default/hover) with tap emitting 'navigate'.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, regions, transform, events, intent } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const sprites = {};
  for (const key of ['default', 'hover']) {
    if (!regions[key]) continue;
    const s = new PIXI.Sprite(atlas.getTexture(regions[key]));
    s.width = transform.width;
    s.height = transform.height;
    s.alpha = key === 'default' ? 1 : 0;
    container.addChild(s);
    sprites[key] = s;
  }

  const show = (key) => {
    for (const [k, s] of Object.entries(sprites)) gsap.to(s, { alpha: k === key ? 1 : 0, duration: 0.15 });
  };
  container.on('pointerover', () => show('hover'));
  container.on('pointerout',  () => show('default'));
  container.on('pointertap',  () => events.emit('navigate', { source: intent.nodeId }));

  return { container, teardown: () => container.destroy({ children: true }) };
}
