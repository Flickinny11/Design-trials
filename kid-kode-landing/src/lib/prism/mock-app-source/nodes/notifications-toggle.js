// Prism node: notifications-toggle — layer-swap between off/on regions (mock
// spec §3.4.2 verbatim template, ctx-injected dependencies).
export function createNode(ctx) {
  const { PIXI, gsap, atlas, regions, transform, state, events, intent, backend } = ctx;

  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const offSprite = new PIXI.Sprite(atlas.getTexture(regions.off));
  offSprite.width = transform.width;
  offSprite.height = transform.height;
  container.addChild(offSprite);

  const onSprite = new PIXI.Sprite(atlas.getTexture(regions.on));
  onSprite.width = transform.width;
  onSprite.height = transform.height;
  onSprite.alpha = 0;
  container.addChild(onSprite);

  let isOn = state.get?.('notifications-enabled') ?? false;
  offSprite.alpha = isOn ? 0 : 1;
  onSprite.alpha = isOn ? 1 : 0;

  container.on('pointertap', async () => {
    isOn = !isOn;
    state.set?.('notifications-enabled', isOn);
    gsap.to(offSprite, { alpha: isOn ? 0 : 1, duration: 0.15 });
    gsap.to(onSprite,  { alpha: isOn ? 1 : 0, duration: 0.15 });
    events.emit('notifications-toggled', { source: intent.nodeId, isOn });
    try {
      await backend?.call?.('/api/mock/user-preferences', { method: 'POST', body: { notificationsEnabled: isOn } });
    } catch (_) { /* SHR watchdog picks up failures */ }
  });

  return { container, teardown: () => container.destroy({ children: true }) };
}
