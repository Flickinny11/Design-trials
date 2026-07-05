'use client';

// PRISM MARKETING — PUBLIC HEADER (SHELL W6, S2)
//
// The public site header — distinct from the signed-in ShellNav3D (which needs
// a session and links into /app). Sticky, crisp hairline seam (DL7), a machined
// prism brandmark (identity SVG, red/chrome — not a UI icon-pack glyph), a nav,
// and the two entry actions. Collapses to an accessible menu button + drawer at
// tablet width. Fully keyboard operable; the drawer closes on Escape and route
// change.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
  { href: '/changelog', label: 'Changelog' },
];

function Brandmark() {
  return (
    <svg className="mk-brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="mkbrand-c" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6f8fb" />
          <stop offset="100%" stopColor="#5f636c" />
        </linearGradient>
        <linearGradient id="mkbrand-r" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#ff5a55" />
          <stop offset="60%" stopColor="#ff2a38" />
          <stop offset="100%" stopColor="#7d0f18" />
        </linearGradient>
      </defs>
      <polygon points="20,4 34,28 6,28" fill="url(#mkbrand-c)" opacity="0.9" />
      <polygon points="20,4 20,28 6,28" fill="#0b0b10" opacity="0.55" />
      <polygon points="20,14 27,28 13,28" fill="url(#mkbrand-r)" />
    </svg>
  );
}

export default function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="mk-header">
      <div className="mk-wrap mk-header-row">
        <Link href="/home" className="mk-brand" title="Prism — home">
          <Brandmark />
          <span className="mk-brand-word">Prism</span>
        </Link>

        <nav className="mk-nav" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="mk-nav-link"
              aria-current={pathname === n.href ? 'page' : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="mk-nav-actions">
          <Link href="/sign-in" className="mk-btn mk-btn-ghost">
            Sign in
          </Link>
          <Link href="/app/build" className="mk-btn mk-btn-red">
            Start building
          </Link>
          <button
            type="button"
            className="mk-menu-btn"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mk-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              {open ? (
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div className="mk-mobile-menu" id="mk-mobile-menu" data-open={open ? 'true' : 'false'}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="mk-mobile-link">
            {n.label}
          </Link>
        ))}
        <div className="mk-mobile-actions">
          <Link href="/sign-in" className="mk-btn mk-btn-ghost">
            Sign in
          </Link>
          <Link href="/app/build" className="mk-btn mk-btn-red">
            Start building
          </Link>
        </div>
      </div>
    </header>
  );
}
