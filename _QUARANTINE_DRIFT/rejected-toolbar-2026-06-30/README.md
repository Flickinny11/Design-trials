# Rejected Toolbar Rewrite Quarantine

This directory preserves the rejected `kid-kode-landing/src/components/editor/glass-toolbar`
rewrite for evidence only.

Do not wire this code into the root editor. The live canvas toolbar is
`kid-kode-landing/src/components/editor/overlays/liquid-toolbar/LiquidGlassToolbar.tsx`
through `CanvasToolbar.tsx`.

Reason: the rewrite introduced `VerticalChassisToolbar` as a drop-in replacement
and was rejected in live review. It is quarantined so future autonomous runs do
not mistake it for an accepted implementation.
