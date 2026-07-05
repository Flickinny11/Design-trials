// PRISM MARKETING — PUBLIC FOOTER (SHELL W6, S2)
//
// Server component — pure crawlable links. Grouped site map + legal line. No
// client JS. Matches the dark-first machined surface (DL1/DL7).

import Link from 'next/link';

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/gallery', label: 'Gallery' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/app/build', label: 'Start building' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/docs', label: 'Documentation' },
      { href: '/changelog', label: 'Changelog' },
      { href: '/gallery', label: 'Templates' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/legal', label: 'Legal' },
      { href: '/legal/terms', label: 'Terms' },
      { href: '/legal/privacy', label: 'Privacy' },
    ],
  },
];

export default function MarketingFooter() {
  const year = 2026;
  return (
    <footer className="mk-footer">
      <div className="mk-wrap">
        <div className="mk-footer-grid">
          <div>
            <Link href="/home" className="mk-brand" title="Prism — home">
              <svg className="mk-brand-mark" viewBox="0 0 40 40" aria-hidden="true">
                <defs>
                  <linearGradient id="mkf-c" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f6f8fb" />
                    <stop offset="100%" stopColor="#5f636c" />
                  </linearGradient>
                  <linearGradient id="mkf-r" x1="0" y1="0" x2="0.4" y2="1">
                    <stop offset="0%" stopColor="#ff5a55" />
                    <stop offset="60%" stopColor="#ff2a38" />
                    <stop offset="100%" stopColor="#7d0f18" />
                  </linearGradient>
                </defs>
                <polygon points="20,4 34,28 6,28" fill="url(#mkf-c)" opacity="0.9" />
                <polygon points="20,4 20,28 6,28" fill="#0b0b10" opacity="0.55" />
                <polygon points="20,14 27,28 13,28" fill="url(#mkf-r)" />
              </svg>
              <span className="mk-brand-word">Prism</span>
            </Link>
            <p className="mk-footer-blurb">
              The prompt-to-app builder that renders your product as a real 3D world —
              verified before it ships, and yours to deploy anywhere.
            </p>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <p className="mk-footer-col-title">{col.title}</p>
              <ul className="mk-footer-links">
                {col.links.map((l) => (
                  <li key={`${col.title}-${l.href}-${l.label}`}>
                    <Link href={l.href} className="mk-footer-link">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mk-footer-bottom">
          <span className="mk-footer-legal">© {year} Kriptik · Prism. All rights reserved.</span>
          <span className="mk-footer-legal">Built with Prism.</span>
        </div>
      </div>
    </footer>
  );
}
