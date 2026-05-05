// Prism node: footer-newsletter-pill — pill input affordance with MSDF
// placeholder text; tap opens newsletter-modal.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, transform, events, intent, msdfFont } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const sprite = new PIXI.Sprite(atlas.getTexture(region));
  sprite.width = transform.width;
  sprite.height = transform.height;
  sprite.alpha = 0.85;
  container.addChild(sprite);

  const labelSpec = (intent?.visualSpec?.textContent ?? []).find((t) => t.renderMethod === 'msdf');
  if (labelSpec) {
    const pos = labelSpec.position ?? { x: transform.width / 2, y: transform.height / 2, anchor: 'center' };
    const label = new PIXI.BitmapText({
      text: labelSpec.text,
      style: {
        fontFamily: msdfFont?.family ?? 'Inter-Variable',
        fontSize: labelSpec.typography?.fontSize ?? 14,
        fill: labelSpec.typography?.color ?? 0x9ca3af,
      },
    });
    label.anchor?.set?.(0.5, 0.5);
    label.position.set(pos.x, pos.y);
    container.addChild(label);
  }

  container.on('pointerover', () => gsap.to(sprite, { alpha: 1.0, duration: 0.2 }));
  container.on('pointerout',  () => gsap.to(sprite, { alpha: 0.85, duration: 0.2 }));
  container.on('pointerdown', () => gsap.to(container.scale, { x: 0.97, y: 0.97, duration: 0.08 }));
  container.on('pointerup',   () => gsap.to(container.scale, { x: 1.0,  y: 1.0,  duration: 0.12, ease: 'back.out(2)' }));
  container.on('pointertap',  () => events.emit('open-modal', { source: intent.nodeId, target: 'newsletter-modal' }));

  return { container, teardown: () => container.destroy({ children: true }) };
}
