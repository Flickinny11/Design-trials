// Prism node: theme-selector-button — single pill sprite with runtime GSAP
// hover/press effects + MSDF "Theme" label. Previously 3-state layer-swap
// from independently-generated FAL images which drifted. Now a single base
// with brighten-on-hover, scale-on-press. Tap cycles theme and emits
// theme-changed.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, region, transform, state, events, intent, backend, msdfFont } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const base = new PIXI.Sprite(atlas.getTexture(region));
  base.width = transform.width;
  base.height = transform.height;
  container.addChild(base);

  // MSDF label "Theme" centered on the button.
  const labelSpec = (intent?.visualSpec?.textContent ?? []).find((t) => t.renderMethod === 'msdf');
  if (labelSpec) {
    const pos = labelSpec.position ?? { x: transform.width / 2, y: transform.height / 2, anchor: 'center' };
    const label = new PIXI.BitmapText({
      text: labelSpec.text,
      style: {
        fontFamily: msdfFont?.family ?? 'Inter-Variable',
        fontSize: labelSpec.typography?.fontSize ?? 14,
        fill: labelSpec.typography?.color ?? 0xe5eaff,
      },
    });
    label.anchor?.set?.(0.5, 0.5);
    label.position.set(pos.x, pos.y);
    container.addChild(label);
  }

  const CYCLE = ['light', 'dark', 'system'];
  let idx = CYCLE.indexOf(state.get?.('theme') ?? 'dark');
  if (idx < 0) idx = 1;

  container.on('pointerover', () => gsap.to(base, { alpha: 1, tint: 0xfff0d8, duration: 0.15 }));
  container.on('pointerout',  () => gsap.to(base, { alpha: 1, tint: 0xffffff, duration: 0.15 }));
  container.on('pointerdown', () => gsap.to(container.scale, { x: 0.97, y: 0.97, duration: 0.08 }));
  container.on('pointerup',   () => gsap.to(container.scale, { x: 1,    y: 1,    duration: 0.12, ease: 'back.out(2)' }));
  container.on('pointertap',  async () => {
    idx = (idx + 1) % CYCLE.length;
    const next = CYCLE[idx];
    state.set?.('theme', next);
    events.emit('theme-changed', { source: intent.nodeId, theme: next });
    try {
      await backend?.call?.('/api/mock/user-preferences', { method: 'POST', body: { theme: next } });
    } catch (_) { /* SHR picks it up */ }
  });

  return { container, teardown: () => container.destroy({ children: true }) };
}
