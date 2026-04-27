// Prism node: hero-card-bg — listens for build-flow-started to flash acknowledgement.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, transform, events } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  const sprite = new PIXI.Sprite(atlas.getTexture(region));
  sprite.width = transform.width;
  sprite.height = transform.height;
  container.addChild(sprite);

  const off = events.on?.("build-flow-started", () => {
    gsap.fromTo(
      sprite,
      { alpha: 0.6 },
      { alpha: 1.0, duration: 0.35, ease: "power2.out" },
    );
  });

  return {
    container,
    teardown() {
      off?.();
      container.destroy({ children: true });
    },
  };
}
