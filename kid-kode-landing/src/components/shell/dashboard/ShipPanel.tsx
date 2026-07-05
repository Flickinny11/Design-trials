'use client';

// PRISM SHELL — SHIP ENTRY (SHELL W4 stub for E13/E14–E20)
//
// The founder's "ship & make profitable" entry, present in the global nav from
// W4 so users see where publishing lives — but honest: the one-click host
// adapters (Vercel/Netlify/Cloudflare · Modal/RunPod/Vast), in-platform domain
// purchase, and the completeness→ship→verify flow are built in W5/W5B. A build
// ships from its builder; the CTA routes there rather than dead-ending.
// Clean-but-premium working surface (Decision A).

interface ShipRow {
  key: string;
  title: string;
  detail: string;
  wave: string;
}

const ROADMAP: readonly ShipRow[] = [
  {
    key: 'preview',
    title: 'Preview URLs',
    detail: 'Every build ships a shareable preview from its builder — verified before it ships.',
    wave: 'Live',
  },
  {
    key: 'verify',
    title: 'Verified shippable',
    detail: 'Builds gate on behavioral + visual + deploy verification (I9) — the Conductor.',
    wave: 'Live',
  },
  {
    key: 'hosts',
    title: 'One-click hosts',
    detail: 'Ship frontend & backend to Vercel, Netlify, Cloudflare, Modal, RunPod, Vast.',
    wave: 'W5B',
  },
  {
    key: 'domains',
    title: 'Domains in-platform',
    detail: 'Search, buy, and auto-configure DNS without leaving Prism.',
    wave: 'W5B',
  },
  {
    key: 'profit',
    title: 'Ship & make profitable',
    detail: 'A completeness scan adds missing auth/DB/payments, then ships.',
    wave: 'W5B',
  },
];

export default function ShipPanel({
  hasProjects,
}: {
  hasProjects: boolean;
}) {
  return (
    <section className="dw-panel" aria-labelledby="dw-ship-h">
      <div className="dw-panel-head">
        <div>
          <p className="dw-panel-kicker">SHIP · E13–E20</p>
          <h2 id="dw-ship-h" className="dw-panel-title">
            Publish &amp; make profitable
          </h2>
        </div>
      </div>
      <p className="dw-panel-lead">
        Ship a verified build to any host, buy a domain, and go live — all from
        Prism, one click, no leaving the platform. Wiring the host adapters now.
      </p>
      <ul className="dw-ship-list">
        {ROADMAP.map((r) => (
          <li key={r.key} className="dw-ship-row">
            <span className="dw-ship-dot" aria-hidden />
            <span className="dw-ship-body">
              <span className="dw-ship-title">{r.title}</span>
              <span className="dw-ship-detail">{r.detail}</span>
            </span>
            <span className="dw-ship-wave">{r.wave}</span>
          </li>
        ))}
      </ul>
      <p className="dw-panel-foot">
        {hasProjects
          ? 'Open a build to ship it — the ship flow lives in the builder once a build is verified.'
          : 'Build something first — then ship it from its builder.'}
      </p>
    </section>
  );
}
