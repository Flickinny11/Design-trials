// Prism node: page-background
// Large scroll-length backdrop sprite. Listens for theme-changed to tint.
export function createNode(ctx) {
  const { PIXI, atlas, region, transform, events } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);

  const sprite = new PIXI.Sprite(atlas.getTexture(region));
  sprite.width = transform.width;
  sprite.height = transform.height;
  container.addChild(sprite);

  const off = events.on?.("theme-changed", ({ theme }) => {
    sprite.tint = theme === "light" ? 0xf5f7ff : 0xffffff;
  });

  return {
    container,
    teardown() {
      off?.();
      container.destroy({ children: true });
    },
  };
}
