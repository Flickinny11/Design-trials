'use client';

// W-TPL D5 — the picker launch button. Self-contained editor chrome (mounted in
// the modal cluster of app/page.tsx) so it touches neither TopBar nor
// CanvasToolbar (I-ADDITIVE). Mode-aware:
//   • galaxy  → "New hub from template" (opens the picker in 'hub' mode)
//   • canvas  → "Add a section"        (opens the picker in 'section' mode)
//   • preview-app → hidden (this is the shipped app, not the editor).

import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useTemplatePickerStore } from '@/stores/useTemplatePickerStore';

export default function TemplateLauncher() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const openPicker = useTemplatePickerStore((s) => s.openPicker);
  const pickerOpen = useTemplatePickerStore((s) => s.open);

  if (viewMode === 'preview-app') return null;
  const isGalaxy = viewMode === 'galaxy';

  return (
    <div className="absolute bottom-4 left-4 z-40 pointer-events-auto" data-template-launcher>
      <button
        type="button"
        onClick={() => openPicker(isGalaxy ? 'hub' : 'section')}
        aria-label={isGalaxy ? 'New hub from template' : 'Add a section from a template'}
        aria-expanded={pickerOpen}
        data-template-launch={isGalaxy ? 'hub' : 'section'}
        className="ds-metal ds-grain ds-edge ds-press group flex items-center gap-2 pl-2.5 pr-3.5 h-10 rounded-full font-ui text-[12.5px] font-semibold text-ds-text hover:text-white transition-colors"
        style={{ boxShadow: 'var(--ds-chamfer-soft), var(--ds-glow-arc)' }}
      >
        <span
          aria-hidden
          className="grid place-items-center w-6 h-6 rounded-full text-[15px] leading-none text-ds-void"
          style={{ background: 'var(--ds-grad-brass, linear-gradient(180deg,#e8c583,#b08d3f))' }}
        >
          +
        </span>
        <span className="whitespace-nowrap">
          {isGalaxy ? 'New hub from template' : 'Add a section'}
        </span>
      </button>
    </div>
  );
}
