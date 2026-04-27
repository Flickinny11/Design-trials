// Prism node: hero-card-cta — CTA button with glow-pulse + shimmer overlay layers
// (mock spec §3.4.1 verbatim, ctx-injected). ALLOWED-GRAPHICS: the PIXI.Graphics
// below is used solely as a clip mask for the shimmer sweep (§1.4 exception).
export function createNode(ctx) {
  const {
    PIXI,
    gsap,
    atlas,
    region,
    overlayRegions,
    transform,
    events,
    backend,
    intent,
    msdfFont,
  } = ctx;

  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = "static";
  container.cursor = "pointer";

  // Layer 1 (bottom): soft glow, hidden by default.
  // .label on each sprite is the §10.11 verification contract — the T06 test
  // addresses layers by label so child-index drift can't make the test pass
  // silently.
  const glow = new PIXI.Sprite(atlas.getTexture(overlayRegions["glow-pulse"]));
  glow.label = "glow";
  glow.anchor.set(0.5);
  glow.x = transform.width / 2;
  glow.y = transform.height / 2;
  glow.width = transform.width * 1.15;
  glow.height = transform.height * 1.4;
  glow.alpha = 0;
  container.addChild(glow);

  // Layer 2 (middle): base button.
  const base = new PIXI.Sprite(atlas.getTexture(region));
  base.label = "base";
  base.width = transform.width;
  base.height = transform.height;
  base.anchor.set(0.5);
  base.x = transform.width / 2;
  base.y = transform.height / 2;
  container.addChild(base);

  // Layer 3 (top): shimmer sweep, masked to button shape.
  const shimmer = new PIXI.Sprite(atlas.getTexture(overlayRegions["shimmer"]));
  shimmer.label = "shimmer";
  shimmer.anchor.set(0.5);
  shimmer.x = -transform.width / 2;
  shimmer.y = transform.height / 2;
  shimmer.width = transform.width * 0.4;
  shimmer.height = transform.height;
  shimmer.alpha = 0;
  // ALLOWED-GRAPHICS: shimmer mask (§1.4 exception — masks are permitted).
  const shimmerMask = new PIXI.Graphics()
    .roundRect(0, 0, transform.width, transform.height, 12)
    .fill(0xffffff);
  shimmer.mask = shimmerMask;
  container.addChild(shimmerMask);
  container.addChild(shimmer);

  // MSDF label — "Get Started" at runtime, not baked into the atlas image.
  const labelSpec = (intent?.visualSpec?.textContent ?? []).find(
    (t) => t.renderMethod === "msdf",
  );
  if (labelSpec) {
    const pos = labelSpec.position ?? {
      x: transform.width / 2,
      y: transform.height / 2,
      anchor: "center",
    };
    const label = new PIXI.BitmapText({
      text: labelSpec.text,
      style: {
        fontFamily: msdfFont?.family ?? "Inter-Variable",
        fontSize: labelSpec.typography?.fontSize ?? 18,
        fill: labelSpec.typography?.color ?? 0xffffff,
      },
    });
    label.anchor?.set?.(0.5, 0.5);
    label.position.set(pos.x, pos.y);
    container.addChild(label);
  }

  container.on("pointerover", () => {
    gsap.to(base.scale, {
      x: 1.03,
      y: 1.03,
      duration: 0.2,
      ease: "power2.out",
    });
    gsap.to(glow, { alpha: 0.6, duration: 0.2 });
    gsap.fromTo(
      shimmer,
      { alpha: 0, x: -transform.width / 2 },
      {
        alpha: 0.8,
        x: transform.width * 1.5,
        duration: 0.6,
        ease: "power2.inOut",
      },
    );
  });
  container.on("pointerout", () => {
    gsap.to(base.scale, { x: 1.0, y: 1.0, duration: 0.2 });
    gsap.to(glow, { alpha: 0, duration: 0.2 });
  });
  container.on("pointerdown", () => {
    gsap.to(base.scale, { x: 0.97, y: 0.97, duration: 0.08 });
  });
  container.on("pointerup", () => {
    gsap.to(base.scale, {
      x: 1.03,
      y: 1.03,
      duration: 0.12,
      ease: "back.out(2)",
    });
  });
  container.on("pointertap", async () => {
    events.emit("build-flow-started", { source: intent.nodeId });
    try {
      await backend.call("/api/mock/track-cta-click", {
        method: "POST",
        body: {},
      });
      gsap.to(glow, {
        alpha: 1.0,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut",
        onComplete: () => {
          glow.alpha = 0;
        },
      });
    } catch (_) {
      // SHR watchdog picks up the failure.
    }
  });

  return {
    container,
    teardown: () => container.destroy({ children: true }),
  };
}
