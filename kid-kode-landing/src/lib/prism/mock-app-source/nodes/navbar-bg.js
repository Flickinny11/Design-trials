// Prism node: navbar-bg — non-interactive backdrop.
export function createNode(ctx) {
  const { PIXI, atlas, region, transform } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  const sprite = new PIXI.Sprite(atlas.getTexture(region));
  sprite.width = transform.width;
  sprite.height = transform.height;
  container.addChild(sprite);
  return { container, teardown: () => container.destroy({ children: true }) };
}
