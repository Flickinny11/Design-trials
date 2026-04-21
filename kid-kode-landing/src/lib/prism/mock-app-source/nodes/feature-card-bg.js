// Prism node: feature-card-bg — subtle lift-hover interaction (Method 2 GSAP).
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, transform } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'default';

  const sprite = new PIXI.Sprite(atlas.getTexture(region));
  sprite.width = transform.width;
  sprite.height = transform.height;
  container.addChild(sprite);

  container.on('pointerover', () => gsap.to(container, { y: transform.y - 4, duration: 0.25, ease: 'power2.out' }));
  container.on('pointerout',  () => gsap.to(container, { y: transform.y,     duration: 0.25 }));

  return { container, teardown: () => container.destroy({ children: true }) };
}
