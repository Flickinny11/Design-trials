'use client';

// PRISM SHELL — SHARE DIALOG (SHELL W7, spec §6.9 S9)
//
// Org-scoped sharing: private · view · comment · edit (§6.9.1), plus the
// internal org URL to hand off (§6.9.3). Enterprise-gated — a non-enterprise
// account sees an honest "Private — Enterprise capability" state with NO
// sharing controls (the multiplayer surface never appears). Owner-only manage;
// a shared member sees a read-only "shared with you as {role}" state.

import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useState } from 'react';
import type { PrismGrantRole } from '../../../../packages/shared-interfaces/src/prism-sharing';
import { listOrgs, getProjectShare, setProjectShare } from '@/lib/shell/sharing-client';

type OrgVisibility = 'private' | PrismGrantRole;

export default function ShareDialog({
  projectId,
  role,
  canManageSharing,
  enterprise,
}: {
  projectId: string;
  role: 'owner' | 'edit' | 'comment' | 'view' | null;
  canManageSharing: boolean;
  enterprise: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [orgId, setOrgId] = useState<string>('');
  const [visibility, setVisibility] = useState<OrgVisibility>('private');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const shareLabel = visibility === 'private' ? 'Private' : `Org · ${visibility}`;

  // Load current share state on MOUNT (not just on open) so the trigger label
  // reflects reality — a shared project must not read "Private" until opened.
  useEffect(() => {
    if (!canManageSharing) return;
    let alive = true;
    (async () => {
      try {
        const [myOrgs, share] = await Promise.all([listOrgs(), getProjectShare(projectId)]);
        if (!alive) return;
        setOrgs(myOrgs.map((o) => ({ id: o.id, name: o.name })));
        if (share) {
          setOrgId(share.orgId);
          const orgGrant = share.grants.find((g) => g.subjectType === 'org');
          setVisibility(share.visibility === 'private' || !orgGrant ? 'private' : orgGrant.role);
        } else if (myOrgs[0]) {
          setOrgId(myOrgs[0].id);
        }
      } catch {
        /* leaves the default; the user can retry from the dialog */
      }
    })();
    return () => {
      alive = false;
    };
  }, [canManageSharing, projectId]);

  const apply = useCallback(
    async (next: OrgVisibility) => {
      if (!orgId) {
        setNote('Create an organization in Settings first.');
        return;
      }
      setBusy(true);
      setNote(null);
      try {
        const grants =
          next === 'private'
            ? []
            : [{ subjectType: 'org' as const, role: next as PrismGrantRole }];
        await setProjectShare(projectId, orgId, grants);
        setVisibility(next);
        setNote(next === 'private' ? 'Project is now private.' : `Shared with the org as ${next}.`);
      } catch {
        setNote('Could not update sharing.');
      } finally {
        setBusy(false);
      }
    },
    [orgId, projectId],
  );

  const orgUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/app/builder/${projectId}` : '';

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="bw1-topbtn" aria-label="Share this project">
          <span className="bw1-topbtn-kicker">Share</span>
          <span className="bw1-topbtn-value">{role === 'owner' || canManageSharing ? shareLabel : 'Shared'}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bw1-share-overlay" />
        <Dialog.Content className="bw1-share" aria-describedby={undefined}>
          <Dialog.Title className="bw1-share-title">Share this project</Dialog.Title>

          {!enterprise ? (
            <div className="bw1-share-body">
              <p className="bw1-share-lead">This project is private to you.</p>
              <p className="bw1-share-muted">
                Organization sharing and live multiplayer are an{' '}
                <strong>Enterprise</strong> capability — invite teammates into one org,
                share builds, and co-edit in real time. Individual accounts stay fully
                private and isolated.
              </p>
              <a className="bw1-share-cta" href="/app?panel=settings">
                See Enterprise in Settings
              </a>
            </div>
          ) : !canManageSharing ? (
            <div className="bw1-share-body">
              <p className="bw1-share-lead">
                Shared with you as <strong>{role}</strong>.
              </p>
              <p className="bw1-share-muted">
                Only the project owner can change who it&apos;s shared with.
              </p>
            </div>
          ) : (
            <div className="bw1-share-body">
              {orgs.length > 1 ? (
                <label className="bw1-share-field">
                  <span>Organization</span>
                  <select
                    className="bw1-share-select"
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <fieldset className="bw1-share-roles" disabled={busy}>
                <legend>Org access</legend>
                {(['private', 'view', 'comment', 'edit'] as OrgVisibility[]).map((v) => (
                  <label key={v} className="bw1-share-role" data-active={visibility === v}>
                    <input
                      type="radio"
                      name="bw1-visibility"
                      value={v}
                      checked={visibility === v}
                      onChange={() => apply(v)}
                    />
                    <span className="bw1-share-role-name">{v === 'private' ? 'Private' : v}</span>
                    <span className="bw1-share-role-desc">
                      {v === 'private'
                        ? 'Only you'
                        : v === 'view'
                          ? 'Org can view'
                          : v === 'comment'
                            ? 'Org can view + comment'
                            : 'Org can edit + chat with the builder'}
                    </span>
                  </label>
                ))}
              </fieldset>

              <label className="bw1-share-field">
                <span>Org link</span>
                <div className="bw1-share-link">
                  <input readOnly value={orgUrl} className="bw1-share-linkinput" />
                  <button
                    type="button"
                    className="bw1-share-copy"
                    onClick={() => navigator.clipboard?.writeText(orgUrl)}
                  >
                    Copy
                  </button>
                </div>
              </label>

              {note ? <p className="bw1-share-note">{note}</p> : null}
            </div>
          )}

          <Dialog.Close asChild>
            <button type="button" className="bw1-share-close" aria-label="Close">
              Done
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
