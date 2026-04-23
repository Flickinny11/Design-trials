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
    // Text positions in the graph are authored against each node's base
    // `transform` (e.g. 1280-wide hero-card-headline-text). When the active
    // breakpoint's transform widens (mobile = 1800), a center-anchored text
    // authored at x=640 sits 35% from left instead of dead-center. Remap
    // center-anchored text to transform.width/2 so "centered" always means
    // centered against the currently-active container width.
    const anchorX = pos.anchor === 'center' ? transform.width / 2
                  : pos.anchor === 'right'  ? transform.width - (pos.x ?? 0)
                                            : (pos.x ?? 0);
    const anchorY = pos.y ?? transform.height / 2;
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
    txt.position.set(anchorX, anchorY);
    container.addChild(txt);
  }

  return { container, teardown: () => container.destroy({ children: true }) };
}
