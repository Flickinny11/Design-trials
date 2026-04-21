// Prism node: theme-selector-button — 3-state layer-swap (default/hover/pressed).
// Tap cycles theme (light/dark/system), emits theme-changed.
export function createNode(ctx) {
  const { PIXI, gsap, atlas, regions, transform, state, events, intent, backend } = ctx;
  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const sprites = {};
  for (const key of ['default', 'hover', 'pressed']) {
    if (!regions[key]) continue;
    const s = new PIXI.Sprite(atlas.getTexture(regions[key]));
    s.width = transform.width;
    s.height = transform.height;
    s.alpha = key === 'default' ? 1 : 0;
    container.addChild(s);
    sprites[key] = s;
  }

  const show = (key) => {
    for (const [k, s] of Object.entries(sprites)) gsap.to(s, { alpha: k === key ? 1 : 0, duration: 0.15 });
  };

  const CYCLE = ['light', 'dark', 'system'];
  let idx = CYCLE.indexOf(state.get?.('theme') ?? 'dark');
  if (idx < 0) idx = 1;

  container.on('pointerover', () => show('hover'));
  container.on('pointerout',  () => show('default'));
  container.on('pointerdown', () => show('pressed'));
  container.on('pointerup',   () => show('hover'));
  container.on('pointertap',  async () => {
    idx = (idx + 1) % CYCLE.length;
    const next = CYCLE[idx];
    state.set?.('theme', next);
    events.emit('theme-changed', { source: intent.nodeId, theme: next });
    try {
      await backend?.call?.('/api/mock/user-preferences', { method: 'POST', body: { theme: next } });
    } catch (_) { /* SHR */ }
  });

  return { container, teardown: () => container.destroy({ children: true }) };
}
