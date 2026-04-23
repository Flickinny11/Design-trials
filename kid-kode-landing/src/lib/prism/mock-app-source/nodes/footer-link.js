// Prism node: footer-link-{privacy,terms,contact} — text-only clickable
// label. Text renders via MSDF BitmapText at runtime. Previously carried
// a FAL-generated substrate image, but FLUX baked gibberish onto
// sign-shaped surfaces; now textOnly so the text sits directly on
// whatever background is beneath. Click target is the container bounds.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, transform, events, intent, msdfFont } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  // Invisible hit-area at container dimensions so the whole rect stays
  // tappable even when there's no sprite.
  container.hitArea = new PIXI.Rectangle(0, 0, transform.width, transform.height);

  // If a substrate region IS present, stamp it. Otherwise pure text.
  if (region && atlas.hasTexture?.(region) !== false) {
    try {
      const base = new PIXI.Sprite(atlas.getTexture(region));
      base.width = transform.width;
      base.height = transform.height;
      base.alpha = 0.78;
      container.addChild(base);
    } catch { /* textOnly — no sprite */ }
  }

  // MSDF label.
  const labelSpec = (intent?.visualSpec?.textContent ?? []).find((t) => t.renderMethod === 'msdf');
  let label = null;
  if (labelSpec) {
    const pos = labelSpec.position ?? { x: transform.width / 2, y: transform.height / 2, anchor: 'center' };
    // Remap 'center' anchor to container center so text stays centered
    // across breakpoint-reflowed widths.
    const isCenterAnchor = pos.anchor === 'center';
    const x = isCenterAnchor ? transform.width / 2 : (pos.x ?? 0);
    const y = pos.y ?? transform.height / 2;
    label = new PIXI.BitmapText({
      text: labelSpec.text,
      style: {
        fontFamily: msdfFont?.family ?? 'Inter-Variable',
        fontSize: labelSpec.typography?.fontSize ?? 14,
        fill: labelSpec.typography?.color ?? 0xcbd5ff,
      },
    });
    if (isCenterAnchor) label.anchor?.set?.(0.5, 0.5);
    else if (pos.anchor === 'right') label.anchor?.set?.(1, 0.5);
    else label.anchor?.set?.(0, 0.5);
    label.position.set(x, y);
    label.alpha = 0.82;
    container.addChild(label);
  }

  const baseY = transform.y;
  container.on('pointerover', () => {
    if (label) gsap.to(label, { alpha: 1, duration: 0.15 });
    gsap.to(container.position, { y: baseY - 1, duration: 0.12, ease: 'power2.out' });
  });
  container.on('pointerout', () => {
    if (label) gsap.to(label, { alpha: 0.82, duration: 0.15 });
    gsap.to(container.position, { y: baseY, duration: 0.12 });
  });
  container.on('pointerdown', () => gsap.to(container.scale, { x: 0.96, y: 0.96, duration: 0.08 }));
  container.on('pointerup',   () => gsap.to(container.scale, { x: 1,    y: 1,    duration: 0.12, ease: 'back.out(2)' }));
  container.on('pointertap',  () => events.emit('navigate', { source: intent.nodeId }));

  return { container, teardown: () => container.destroy({ children: true }) };
}
