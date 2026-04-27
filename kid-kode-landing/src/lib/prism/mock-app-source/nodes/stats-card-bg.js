// Prism node: stats-card-bg — material panel + MSDF "Total Clicks:" label.
export function createNode(ctx) {
  const { PIXI, atlas, region, transform, intent, msdfFont } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  const sprite = new PIXI.Sprite(atlas.getTexture(region));
  sprite.width = transform.width;
  sprite.height = transform.height;
  container.addChild(sprite);

  const labelSpec = (intent?.visualSpec?.textContent ?? []).find(
    (t) => t.renderMethod === "msdf",
  );
  if (labelSpec) {
    const pos = labelSpec.position ?? { x: 80, y: 80, anchor: "left" };
    const label = new PIXI.BitmapText({
      text: labelSpec.text,
      style: {
        fontFamily: msdfFont?.family ?? "Inter-Variable",
        fontSize: labelSpec.typography?.fontSize ?? 24,
        fill: labelSpec.typography?.color ?? 0xe5eaff,
      },
    });
    label.anchor?.set?.(
      pos.anchor === "center" ? 0.5 : pos.anchor === "right" ? 1 : 0,
      0.5,
    );
    label.position.set(pos.x, pos.y);
    container.addChild(label);
  }

  return { container, teardown: () => container.destroy({ children: true }) };
}
