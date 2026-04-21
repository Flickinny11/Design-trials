// Prism node: static-text — shared by every node whose only visual is baked-in
// sharp-svg or diffusion text. The text is already composited into the atlas
// region at build time; at runtime we just stamp the sprite.
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
