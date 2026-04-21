// Prism node: stats-live-counter — MSDF BitmapText bound to state.heroCtaClicks
// (mock spec §3.4.2 counter verbatim, ctx-injected). This is the sole place
// BitmapText appears; §1.4 exception 1 covers MSDF runtime text for dynamic data.
export function createNode(ctx) {
  const { PIXI, atlas, region, transform, state, intent, msdfFont } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);

  if (region) {
    const labelSprite = new PIXI.Sprite(atlas.getTexture(region));
    labelSprite.width = transform.width;
    labelSprite.height = transform.height;
    container.addChild(labelSprite);
  }

  const pos = intent.visualSpec?.textContent?.[0]?.position ?? { x: 12, y: 20 };
  const initial = String(state.get?.('heroCtaClicks') ?? 0);
  const countText = new PIXI.BitmapText({
    text: initial,
    style: {
      fontFamily: msdfFont?.family ?? 'Inter-Variable',
      fontSize: intent.visualSpec?.textContent?.[0]?.typography?.fontSize ?? 32,
      fill: 0x4da6ff,
    },
  });
  countText.position.set(pos.x, pos.y);
  container.addChild(countText);

  const off = state.subscribe?.('heroCtaClicks', (count) => {
    countText.text = String(count);
  });

  return {
    container,
    teardown() {
      off?.();
      container.destroy({ children: true });
    },
  };
}
