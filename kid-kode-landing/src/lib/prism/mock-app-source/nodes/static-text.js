// Prism node: static-text — shared by every node whose visual is a material
// substrate plus text. For sharp-svg text, the label is already composited
// into the atlas region at build time; at runtime we just stamp the sprite.
// For msdf text (runtime BitmapText), we stamp the sprite AND render each
// msdf-tagged textContent entry as a BitmapText child on top.
export function createNode(ctx) {
  const { PIXI, atlas, region, transform, intent, msdfFont } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);

  // Some nodes are text-only (hero-card-headline-text, hero-card-subhead-text
  // etc) and don't ship a FAL-generated substrate — the MSDF text renders
  // directly onto whatever card sits beneath at runtime. Skip sprite
  // creation when there's no atlas region.
  if (region && atlas.hasTexture?.(region) !== false) {
    try {
      const sprite = new PIXI.Sprite(atlas.getTexture(region));
      sprite.width = transform.width;
      sprite.height = transform.height;
      container.addChild(sprite);
    } catch {
      // Atlas doesn't have this region — text-only node, fall through to MSDF.
    }
  }

  const msdfEntries = (intent?.visualSpec?.textContent ?? []).filter((t) => t.renderMethod === 'msdf');
  for (const t of msdfEntries) {
    const pos = t.position ?? { x: 0, y: 0, anchor: 'left' };
    const typo = t.typography ?? {};
    // The design coord-space assumes the base image is at its design width
    // (e.g. 1280×96 for hero-card-headline-text). Our sprite IS scaled to
    // transform.width × transform.height which equals design size. The
    // BitmapText renders at its natural glyph size from the atlas MSDF
    // font, so position + size numbers are in design-space and land on
    // the sprite correctly.
    const txt = new PIXI.BitmapText({
      text: t.text,
      style: {
        fontFamily: msdfFont?.family ?? 'Inter-Variable',
        fontSize: typo.fontSize ?? 16,
        fill: typo.color ?? 0xffffff,
        align: pos.anchor === 'center' ? 'center' : pos.anchor === 'right' ? 'right' : 'left',
      },
    });
    // Anchor alignment maps caption 'center' to text's visual center.
    if (pos.anchor === 'center') txt.anchor?.set?.(0.5, 0.5);
    else if (pos.anchor === 'right') txt.anchor?.set?.(1, 0.5);
    else txt.anchor?.set?.(0, 0.5);
    txt.position.set(pos.x, pos.y);
    container.addChild(txt);
  }

  return { container, teardown: () => container.destroy({ children: true }) };
}
