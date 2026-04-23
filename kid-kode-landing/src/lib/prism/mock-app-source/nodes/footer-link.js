// Prism node: footer-link-{privacy,terms,contact} — single base sprite with
// runtime GSAP hover/press effects. Previously used 2-state layer-swap from
// separately-generated FAL images that drifted (default/hover showed different
// element entirely). Now a single sprite brightens + lifts on hover.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, transform, events, intent } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const base = new PIXI.Sprite(atlas.getTexture(region));
  base.width = transform.width;
  base.height = transform.height;
  base.alpha = 0.78;
  container.addChild(base);

  const baseY = transform.y;
  container.on('pointerover', () => {
    gsap.to(base, { alpha: 1.0, duration: 0.15 });
    gsap.to(container.position, { y: baseY - 1, duration: 0.12, ease: 'power2.out' });
  });
  container.on('pointerout', () => {
    gsap.to(base, { alpha: 0.78, duration: 0.15 });
    gsap.to(container.position, { y: baseY, duration: 0.12 });
  });
  container.on('pointerdown', () => gsap.to(container.scale, { x: 0.96, y: 0.96, duration: 0.08 }));
  container.on('pointerup',   () => gsap.to(container.scale, { x: 1,    y: 1,    duration: 0.12, ease: 'back.out(2)' }));
  container.on('pointertap',  () => events.emit('navigate', { source: intent.nodeId }));

  return { container, teardown: () => container.destroy({ children: true }) };
}
