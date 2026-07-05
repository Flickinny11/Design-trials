'use client';

// PRISM SHELL — SHIP TAB (SHELL W5 / S7 · E14 · E15 · E7, 2026-07-04)
//
// The builder's ship surface: the §11 verify latch, one-click deploy targets
// (E15 descriptors — prism-cloud live, external hosts env-gated in dry-run),
// the shareable E14 preview URL, custom-domain field (E16 stub), rollback via
// E1 checkpoints (S7), and E7 export. "Verified shippable" (I9) reflects the
// latch, never a mere "build finished". Clean-but-premium working surface
// (Decision A).

import { useCallback, useEffect, useState } from 'react';
import type { PrismProjectVersion } from '../../../../packages/shared-interfaces/src/prism-tenancy';
import type { DeployTargetKind, VerifyCheck } from '../../../../packages/shared-interfaces/src/prism-conductor';
import { useConductorStore } from '@/lib/shell/conductor-store';
import {
  deployPreview,
  rollbackTo,
  setDeployDomain,
  exportBundle,
  refreshDeploys,
  refreshStatus,
} from '@/lib/shell/conductor-client';
import { listVersions } from '@/lib/shell/tenancy-client';
import DomainPurchaseModal from './DomainPurchaseModal';

function CheckRow({ check }: { check: VerifyCheck | undefined }) {
  if (!check) return null;
  const mark = check.status === 'pass' ? '✓' : check.status === 'fail' ? '✕' : '·';
  return (
    <li className="sw-check" data-status={check.status}>
      <span className="sw-check-mark" aria-hidden>{mark}</span>
      <span className="sw-check-label">{check.label}</span>
    </li>
  );
}

export default function ShipTab({ projectId }: { projectId: string }) {
  const status = useConductorStore((s) => s.status);
  const deploys = useConductorStore((s) => s.deploys);
  const targets = useConductorStore((s) => s.targets);
  const isBuilding = useConductorStore((s) => s.isBuilding);

  const [versions, setVersions] = useState<PrismProjectVersion[]>([]);
  const [busy, setBusy] = useState(false);
  const [domain, setDomain] = useState('');
  const [domainModalOpen, setDomainModalOpen] = useState(false);

  const built = status?.phase === 'built';
  const latch = status?.latch ?? null;
  const latest = deploys[deploys.length - 1] ?? null;

  const reload = useCallback(async () => {
    await Promise.all([refreshStatus(projectId), refreshDeploys(projectId)]);
    try {
      setVersions(await listVersions(projectId));
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload, isBuilding]);

  useEffect(() => {
    if (latest) setDomain(latest.customDomain ?? '');
  }, [latest]);

  const onDeploy = useCallback(async (kind: DeployTargetKind) => {
    setBusy(true);
    await deployPreview({ projectId, kind });
    setBusy(false);
  }, [projectId]);

  const onRollback = useCallback(async (versionId: string) => {
    setBusy(true);
    await rollbackTo({ projectId, versionId, kind: 'prism-cloud' });
    await reload();
    setBusy(false);
  }, [projectId, reload]);

  const onSaveDomain = useCallback(async () => {
    if (!latest) return;
    setBusy(true);
    await setDeployDomain({ deployId: latest.id, projectId, domain });
    setBusy(false);
  }, [latest, projectId, domain]);

  const onExport = useCallback(async () => {
    setBusy(true);
    const url = await exportBundle(projectId);
    setBusy(false);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }, [projectId]);

  if (!built) {
    return (
      <div className="bw1-panel">
        <p className="bw1-panel-kicker">Ship · W5</p>
        <h3 className="bw1-panel-headline">Verified shippable.</h3>
        <p className="bw1-panel-body">
          Build the app first — the Conductor authors it, verifies it (behavioral +
          visual), and ships a shareable preview. Only a passing app earns the badge
          (I9). Use <strong>Build this app</strong> in the preview frame to start.
        </p>
        <p className="bw1-panel-foot">
          “Shippable” means verified, never merely “build finished.”
        </p>
      </div>
    );
  }

  const frontend = targets.filter((t) => t.category === 'frontend');
  const backend = targets.filter((t) => t.category === 'backend');

  return (
    <div className="bw1-panel sw-panel">
      <p className="bw1-panel-kicker">Ship · verified loop</p>

      {/* Verify latch */}
      <div className="sw-latch" data-shippable={latch?.verifiedShippable ? 'true' : 'false'}>
        <div className="sw-latch-head">
          <span className="sw-latch-title">Verification</span>
          {latch?.verifiedShippable ? (
            <span className="bw2-verified-badge sw-latch-badge"><span className="bw2-verified-tick" aria-hidden>✓</span>Verified shippable</span>
          ) : (
            <span className="sw-latch-pending">gaps remain</span>
          )}
        </div>
        <ul className="sw-checks">
          <CheckRow check={latch?.behavioral} />
          <CheckRow check={latch?.visual} />
          <CheckRow check={latch?.deploy} />
          <CheckRow check={latch?.advocate} />
        </ul>
      </div>

      {/* Current preview */}
      {latest ? (
        <div className="sw-preview">
          <span className="sw-section-label">Shareable preview (E14)</span>
          <a className="bw2-preview-link" href={latest.previewUrl} target="_blank" rel="noopener noreferrer">
            {latest.previewUrl.replace(/^https?:\/\//, '')}
          </a>
          <div className="sw-domain-row">
            <input
              className="sw-input"
              value={domain}
              placeholder="custom domain (e.g. app.acme.com)"
              onChange={(e) => setDomain(e.target.value)}
              aria-label="Custom domain"
            />
            <button type="button" className="bw1-minibtn" onClick={onSaveDomain} disabled={busy}>
              {latest.domainStatus === 'pending' ? 'Pending DNS' : latest.domainStatus === 'verified' ? 'Verified' : 'Attach'}
            </button>
          </div>
          <button type="button" className="sw-buy-domain" onClick={() => setDomainModalOpen(true)}>
            Buy a domain in-platform (E16) →
          </button>
        </div>
      ) : null}

      {domainModalOpen && latest ? (
        <DomainPurchaseModal
          projectId={projectId}
          deployId={latest.id}
          initialQuery={domain || 'my-app'}
          onClose={() => setDomainModalOpen(false)}
          onPurchased={(d) => { setDomain(d); void reload(); }}
        />
      ) : null}

      {/* Recent ships + post-ship verification (E15 · §11.2) */}
      {deploys.length > 0 ? (
        <div className="sw-ships">
          <span className="sw-section-label">Recent ships — post-ship verified (§11.2)</span>
          <ul className="sw-ship-list">
            {deploys.slice(-4).reverse().map((d) => (
              <li key={d.id} className="sw-ship" data-status={d.postShip?.status ?? 'pending'}>
                <span className="sw-ship-host">{d.kind}</span>
                <span className="sw-ship-mode" data-mode={d.mode}>{d.mode}</span>
                {d.endpointUrl ? <span className="sw-ship-endpoint">inference endpoint</span> : null}
                <span className="sw-ship-verdict">
                  {d.postShip?.status === 'pass' ? '✓ verified' : d.postShip?.status === 'fail' ? '✕ failed' : '· pending'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* One-click deploy targets (E15) */}
      <div className="sw-targets">
        <span className="sw-section-label">Deploy to a host (E15)</span>
        {[...frontend, ...backend].map((t) => (
          <div key={t.kind} className="sw-target" data-available={t.available ? 'true' : 'false'}>
            <div className="sw-target-body">
              <span className="sw-target-name">{t.label}</span>
              <span className="sw-target-note">{t.note}</span>
              {!t.available && t.requiredEnv.length > 0 ? (
                <span className="sw-target-env">dry-run · set {t.requiredEnv.join(', ')}</span>
              ) : (
                <span className="sw-target-live">{t.available ? 'live' : 'dry-run'}</span>
              )}
            </div>
            <button type="button" className="bw1-minibtn" onClick={() => onDeploy(t.kind)} disabled={busy}>
              {t.category === 'backend' ? 'Ship node' : 'Deploy'}
            </button>
          </div>
        ))}
      </div>

      {/* Rollback (S7) + export (E7) */}
      <div className="sw-actions">
        <span className="sw-section-label">Checkpoints (rollback · S7)</span>
        <ul className="sw-versions">
          {versions.slice(-5).reverse().map((v) => (
            <li key={v.id} className="sw-version">
              <span className="sw-version-label">{v.label}</span>
              <button type="button" className="bw1-minibtn" onClick={() => onRollback(v.id)} disabled={busy}>
                Roll back
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="bw2-build-btn bw2-build-btn--ghost sw-export" onClick={onExport} disabled={busy}>
          Export runtime bundle (E7)
        </button>
      </div>

      <p className="bw1-panel-foot">
        Deploys gate on the §11 latch; env-gated hosts run in dry-run with a
        generated config manifest — no secret ever leaves the server (I5).
      </p>
    </div>
  );
}
