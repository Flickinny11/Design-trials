// Prism node: navbar-signin-btn — CTA-style button with glow overlay, no shimmer.
// Tap emits 'open-modal'.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, overlayRegions, transform, events, intent } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const glow = new PIXI.Sprite(atlas.getTexture(overlayRegions['glow-pulse']));
  glow.anchor.set(0.5);
  glow.x = transform.width / 2;
  glow.y = transform.height / 2;
  glow.width = transform.width * 1.2;
  glow.height = transform.height * 1.6;
  glow.alpha = 0;
  container.addChild(glow);

  const base = new PIXI.Sprite(atlas.getTexture(region));
  base.width = transform.width;
  base.height = transform.height;
  base.anchor.set(0.5);
  base.x = transform.width / 2;
  base.y = transform.height / 2;
  container.addChild(base);

  container.on('pointerover', () => {
    gsap.to(base.scale, { x: 1.03, y: 1.03, duration: 0.2 });
    gsap.to(glow, { alpha: 0.5, duration: 0.2 });
  });
  container.on('pointerout',  () => { gsap.to(base.scale, { x: 1.0, y: 1.0, duration: 0.2 }); gsap.to(glow, { alpha: 0, duration: 0.2 }); });
  container.on('pointerdown', () => gsap.to(base.scale, { x: 0.97, y: 0.97, duration: 0.08 }));
  container.on('pointerup',   () => gsap.to(base.scale, { x: 1.03, y: 1.03, duration: 0.12 }));
  container.on('pointertap',  () => {
    events.emit('open-modal', { source: intent.nodeId, target: 'signin-modal' });
    gsap.to(glow, {
      alpha: 1.0, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.inOut',
      onComplete: () => { glow.alpha = 0; },
    });
  });

  return { container, teardown: () => container.destroy({ children: true }) };
}
