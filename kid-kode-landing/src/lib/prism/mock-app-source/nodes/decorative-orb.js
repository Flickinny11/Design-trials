// Prism node: decorative-orb-{tl,tr,bl,br} — non-interactive ambient orb,
// continuous slow idle pulse (method 1).
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, transform } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);

  const sprite = new PIXI.Sprite(atlas.getTexture(region));
  sprite.anchor.set(0.5);
  sprite.x = transform.width / 2;
  sprite.y = transform.height / 2;
  sprite.width = transform.width;
  sprite.height = transform.height;
  sprite.alpha = 0.7;
  container.addChild(sprite);

  // Two slow pulses out of phase — alpha + scale.
  gsap.to(sprite, { alpha: 0.95, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  gsap.to(sprite.scale, { x: 1.04, y: 1.04, duration: 3.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });

  return { container, teardown: () => container.destroy({ children: true }) };
}
