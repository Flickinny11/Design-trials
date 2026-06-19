'use client';

// LibraryFlyout — the Elements toolbar-group flyout (§13, PREBUILT-LIBRARY-
// CONTRACT). Mirrors change-artifact/ChangeArtifactFlyout.tsx: a small flyout
// with a "Browse Elements" BigKey that opens the root-mounted element browser,
// plain-language copy, and quick category jumps into the browser. Observatory-
// Brass chrome, design-tokens only.

import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { SectionLabel, KEY_BG, KEY_SHADOW } from '@/components/editor/animation-tools/ui';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { elementCount } from '@/lib/editor/elements/registry';
// Side-effect import: registers every prebuilt element on load (§13 barrel) so
// the flyout's count is accurate before the browser ever opens.
import '@/lib/editor/elements/catalog';
import type { PrismHub } from '@/lib/prism-graph/types';

export default function LibraryFlyout({
  hub,
  onToast,
}: {
  hub: PrismHub | null;
  onToast: (msg: string) => void;
}) {
  const openLibrary = useGraphEditorStore((s) => s.openLibrary);
  const hubs = useGraphSourceStore((s) => s.hubs);
  const count = elementCount();

  const browse = () => {
    if (hubs.length === 0) {
      onToast('Open a hub on the canvas first — placed elements attach to it.');
      return;
    }
    openLibrary();
  };

  return (
    <div className="flex flex-col gap-3" data-component="library-flyout">
      <div>
        <SectionLabel>Element library</SectionLabel>
        <div
          className="text-[9px] font-mono leading-relaxed px-0.5 mt-1"
          style={{ color: 'var(--ds-text-low)' }}
        >
          Ready-made 3D pieces — carousels, heroes, and more. Pick one, then drag
          it onto a hub to drop it in. Everything stays fully editable after.
        </div>
      </div>

      <BigKey
        icon="layers"
        title="Browse Elements"
        desc={`${count} ready-made ${count === 1 ? 'piece' : 'pieces'} — hover to preview, drag to place.`}
        onClick={browse}
        testId="library-flyout-browse"
      />

      {hub && (
        <div
          className="text-[9px] font-mono px-0.5"
          style={{ color: 'var(--ds-text-mid)' }}
        >
          Placing into{' '}
          <span style={{ color: 'var(--ds-text)' }}>{hub.title ?? 'this hub'}</span>.
        </div>
      )}
    </div>
  );
}

function BigKey({
  icon,
  title,
  desc,
  onClick,
  testId,
}: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-role={testId}
      onClick={onClick}
      className="flex items-start gap-2.5 p-3 rounded-ds-sm ds-press text-left transition-all hover:brightness-[1.12]"
      style={{
        background: `linear-gradient(178deg, ${dsAlpha(DS_ACCENT, 0.16)}, ${dsAlpha(DS_ACCENT, 0.05)}), ${KEY_BG}`,
        boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.32)}, ${KEY_SHADOW}`,
      }}
    >
      <Icon name={icon} size={16} color={DS.metal200} glow />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[12px] font-mono font-semibold" style={{ color: 'var(--ds-metal-200)' }}>
          {title}
        </span>
        <span className="text-[9px] font-mono leading-snug" style={{ color: 'var(--ds-text-mid)' }}>
          {desc}
        </span>
      </div>
    </button>
  );
}
