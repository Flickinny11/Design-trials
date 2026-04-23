// Prism node: navbar-signin-btn — CTA-style button with glow overlay, no shimmer.
// Tap emits 'open-modal'. Text is MSDF BitmapText at runtime (not diffusion-
// baked into the FAL image) so it reads crisply at any size.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, overlayRegions, transform, events, intent, msdfFont } = ctx;
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

  // MSDF label on top of the button surface. Centered.
  const labelSpec = (intent?.visualSpec?.textContent ?? []).find((t) => t.renderMethod === 'msdf');
  if (labelSpec) {
    const pos = labelSpec.position ?? { x: transform.width / 2, y: transform.height / 2, anchor: 'center' };
    const label = new PIXI.BitmapText({
      text: labelSpec.text,
      style: {
        fontFamily: msdfFont?.family ?? 'Inter-Variable',
        fontSize: labelSpec.typography?.fontSize ?? 14,
        fill: labelSpec.typography?.color ?? 0xffffff,
      },
    });
    label.anchor?.set?.(0.5, 0.5);
    label.position.set(pos.x, pos.y);
    container.addChild(label);
  }

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
