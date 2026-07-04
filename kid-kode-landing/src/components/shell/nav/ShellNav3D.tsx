'use client';

// PRISM SHELL — GLOBAL 3D SLIDE-OUT NAV (SHELL W4, founder addendum E13)
//
// The one navigation affordance present across every shell surface — dashboard
// AND builder (mounted in the /app layout, below the session guard). A premium
// 3D pull (NavHandle3D) lives at the far-LEFT screen edge; HOVER reveals it and
// slides the drawer open on desktop, a TAP on the upper-left chip opens it on
// mobile (touch has no hover). The drawer travels with WEIGHT (DL6 — sprung
// open, gravity close, never linear), is keyboard-operable (Enter opens, Escape
// closes and restores focus) and focus-trapped while open (WCAG 2.2).
//
// Contents: navigation (Projects/Templates/Integrations/Usage/Settings) plus a
// SHIP entry (E13/E17) and the account identity + sign-out. Panel items deep-
// link the dashboard via ?panel=; from the builder they route home to that
// panel, so the nav means the same thing everywhere.
//
// Engine pane unaffected (addendum): when this layout renders INSIDE the
// builder's engine iframe (window.self !== window.top) the affordance renders
// null — the pull never appears over the running prototype.

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut } from '@/lib/shell/auth-client';
import NavEmblem3D from './NavEmblem3D';
import NavHandle3D from './NavHandle3D';

interface NavItem {
  key: string;
  label: string;
  hint: string;
  href: string;
  ship?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { key: 'projects', label: 'Projects', hint: 'Your studio & gallery', href: '/app' },
  { key: 'templates', label: 'Templates', hint: 'Start from a graph', href: '/app?panel=templates' },
  { key: 'integrations', label: 'Integrations', hint: 'Connect anything', href: '/app/integrations' },
  { key: 'usage', label: 'Usage', hint: 'Plan & credits', href: '/app?panel=usage' },
  { key: 'settings', label: 'Settings', hint: 'Account & model', href: '/app?panel=settings' },
  { key: 'ship', label: 'Ship', hint: 'Publish & make profitable', href: '/app?panel=ship', ship: true },
];

export default function ShellNav3D({
  userName,
  userEmail,
  planTier,
}: {
  userName: string;
  userEmail: string;
  planTier: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [open, setOpen] = useState(false);
  const [hoverPeek, setHoverPeek] = useState(false);

  const drawerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount gate: avoids SSR/hydration mismatch for the canvas and lets us detect
  // the engine-iframe case client-side (lazy showpiece behind first paint, DL8).
  useEffect(() => {
    setMounted(true);
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      setEmbedded(true); // cross-origin frame access throws → treat as embedded
    }
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const doClose = useCallback(() => {
    cancelClose();
    setOpen(false);
    setHoverPeek(false);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      // Never yank the drawer out from under keyboard focus.
      const active = document.activeElement;
      if (drawerRef.current && active && drawerRef.current.contains(active)) return;
      setOpen(false);
      setHoverPeek(false);
    }, 180);
  }, [cancelClose]);

  // Focus management + trap + Escape while open (WCAG 2.2, W3 modal idiom).
  useEffect(() => {
    if (!open) return;
    const first = drawerRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
    function focusables(): HTMLElement[] {
      const root = drawerRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        doClose();
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === firstEl || active === drawerRef.current)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, doClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  if (!mounted || embedded) return null;

  function go(item: NavItem) {
    doClose();
    router.push(item.href);
  }

  async function leave() {
    doClose();
    await signOut();
    router.push('/sign-in');
    router.refresh();
  }

  const revealed = open || hoverPeek;
  const activeKey = pathname?.startsWith('/app/integrations')
    ? 'integrations'
    : 'projects';

  return (
    <div
      className="nav3-root"
      data-open={open ? 'true' : 'false'}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      {/* Far-left edge: hover peeks the pull, hover-into opens (desktop);
          the trigger button is the tap target (mobile) + keyboard entry. */}
      <div
        className="nav3-edge"
        onMouseEnter={() => {
          setHoverPeek(true);
          setOpen(true);
        }}
      >
        <NavHandle3D revealed={revealed} />
        <button
          ref={triggerRef}
          type="button"
          className="nav3-trigger"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="nav3-drawer"
          onFocus={() => setHoverPeek(true)}
          onBlur={() => !open && setHoverPeek(false)}
          onClick={() => (open ? doClose() : setOpen(true))}
        />
      </div>

      {/* Dim veil behind the open drawer (a plain scrim, not a glass fake). */}
      <button
        type="button"
        className="nav3-scrim"
        tabIndex={-1}
        aria-hidden
        onClick={doClose}
      />

      <nav
        ref={drawerRef}
        id="nav3-drawer"
        className="nav3-drawer"
        role="dialog"
        aria-modal={open}
        aria-label="Prism navigation"
        aria-hidden={!open}
      >
        <div className="nav3-brand">
          <div className="nav3-emblem" aria-hidden>
            {open ? <NavEmblem3D /> : null}
          </div>
          <div className="nav3-brand-text">
            <span className="nav3-brand-name">PRISM</span>
            <span className="nav3-brand-sub">Studio</span>
          </div>
        </div>

        <ul className="nav3-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.key}>
              <a
                className="nav3-item"
                data-ship={item.ship ? 'true' : 'false'}
                data-active={item.key === activeKey ? 'true' : 'false'}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  go(item);
                }}
              >
                <span className="nav3-item-mark" aria-hidden />
                <span className="nav3-item-body">
                  <span className="nav3-item-label">{item.label}</span>
                  <span className="nav3-item-hint">{item.hint}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="nav3-footer">
          <div className="nav3-account">
            <span className="nav3-account-name">{userName}</span>
            <span className="nav3-account-email">{userEmail}</span>
          </div>
          <span className="nav3-plan" data-tier={planTier}>
            {planTier.toUpperCase()}
          </span>
          <button type="button" className="nav3-signout" onClick={() => void leave()}>
            Sign out
          </button>
        </div>
      </nav>
    </div>
  );
}
