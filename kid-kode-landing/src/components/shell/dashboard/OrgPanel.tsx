'use client';

// PRISM SHELL — ENTERPRISE ORG / TEAM DASHBOARD (SHELL W7, decision E)
//
// The shared org view: seats under one org, member management, and the
// collective builds shared into the org (founder scope note). Enterprise-only
// (the panel is only mounted for enterprise accounts); every read/write goes
// through the audited sharing router, so a non-member never sees another org's
// data. Clean working surface per Decision A.

import { useCallback, useEffect, useState } from 'react';
import type { OrgDashboardOutput } from '../../../../packages/shared-interfaces/src/prism-sharing';
import type { PrismOrg } from '../../../../packages/shared-interfaces/src/prism-tenancy';
import {
  addMember,
  createOrg,
  getOrgDashboard,
  listOrgs,
  removeMember,
} from '@/lib/shell/sharing-client';

export default function OrgPanel({ planTier }: { planTier: string }) {
  const [orgs, setOrgs] = useState<PrismOrg[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>('');
  const [dash, setDash] = useState<OrgDashboardOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [newOrgName, setNewOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listOrgs();
      setOrgs(list);
      if (list[0]) {
        setActiveOrgId((cur) => cur || list[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDash = useCallback(async (orgId: string) => {
    try {
      setDash(await getOrgDashboard(orgId));
    } catch {
      setDash(null);
    }
  }, []);

  useEffect(() => {
    void loadOrgs();
  }, [loadOrgs]);
  useEffect(() => {
    if (activeOrgId) void loadDash(activeOrgId);
  }, [activeOrgId, loadDash]);

  const onCreate = useCallback(async () => {
    if (!newOrgName.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const created = await createOrg(newOrgName.trim());
      setNewOrgName('');
      await loadOrgs();
      setActiveOrgId(created.id);
    } catch {
      setNote('Could not create the organization.');
    } finally {
      setBusy(false);
    }
  }, [newOrgName, loadOrgs]);

  const onInvite = useCallback(async () => {
    if (!inviteEmail.trim() || !activeOrgId) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await addMember(activeOrgId, inviteEmail.trim());
      setInviteEmail('');
      setNote(res.added === 'member' ? 'Member added.' : 'Invite recorded — they join on sign-up.');
      await loadDash(activeOrgId);
    } catch {
      setNote('Could not add that member.');
    } finally {
      setBusy(false);
    }
  }, [inviteEmail, activeOrgId, loadDash]);

  const onRemove = useCallback(
    async (userId: string) => {
      if (!activeOrgId) return;
      setBusy(true);
      try {
        await removeMember(activeOrgId, userId);
        await loadDash(activeOrgId);
      } finally {
        setBusy(false);
      }
    },
    [activeOrgId, loadDash],
  );

  if (planTier !== 'enterprise') {
    return (
      <section className="dw-panel" aria-labelledby="dw-org-h">
        <div className="dw-panel-head">
          <div>
            <p className="dw-panel-kicker">TEAM</p>
            <h2 id="dw-org-h" className="dw-panel-title">Organizations</h2>
          </div>
        </div>
        <p className="dw-panel-lead">
          Organizations, shared builds, and live multiplayer are an Enterprise
          capability. Your account stays fully private and isolated until you join one.
        </p>
      </section>
    );
  }

  return (
    <section className="dw-panel" aria-labelledby="dw-org-h">
      <div className="dw-panel-head">
        <div>
          <p className="dw-panel-kicker">TEAM</p>
          <h2 id="dw-org-h" className="dw-panel-title">
            {dash ? dash.org.name : 'Your organization'}
          </h2>
        </div>
        {dash ? (
          <span className="dw-tier" data-tier="enterprise">
            {dash.seats.used} SEAT{dash.seats.used === 1 ? '' : 'S'}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="dw-panel-loading">Loading your organizations…</p>
      ) : orgs.length === 0 ? (
        <div className="dw-org-create">
          <p className="dw-panel-lead">
            Create an organization to bring teammates onto shared builds with live
            multiplayer co-editing.
          </p>
          <div className="dw-org-row">
            <input
              className="dw-input"
              placeholder="Organization name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
            />
            <button className="dw-btn" onClick={onCreate} disabled={busy || !newOrgName.trim()}>
              Create organization
            </button>
          </div>
        </div>
      ) : (
        <>
          {orgs.length > 1 ? (
            <div className="dw-org-row">
              <label className="dw-org-pick">
                <span>Organization</span>
                <select className="dw-select" value={activeOrgId} onChange={(e) => setActiveOrgId(e.target.value)}>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {/* Members */}
          <h3 className="dw-org-subhead">Members</h3>
          <ul className="dw-org-members">
            {(dash?.org.members ?? []).map((mem) => (
              <li key={mem.userId} className="dw-org-member">
                <div className="dw-org-member-id">
                  <span className="dw-org-member-name">{mem.displayName}</span>
                  <span className="dw-org-member-email">{mem.email}</span>
                </div>
                <span className="dw-org-role" data-role={mem.orgRole}>{mem.orgRole}</span>
                {mem.orgRole !== 'owner' ? (
                  <button className="dw-btn dw-btn-sm dw-btn-ghost" onClick={() => onRemove(mem.userId)} disabled={busy}>
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {(dash?.org.pendingInvites.length ?? 0) > 0 ? (
            <>
              <h3 className="dw-org-subhead">Pending invites</h3>
              <ul className="dw-org-invites">
                {dash?.org.pendingInvites.map((inv) => (
                  <li key={inv.email} className="dw-org-invite">
                    <span>{inv.email}</span>
                    <span className="dw-org-invite-tag">awaiting sign-up</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {/* Invite */}
          <div className="dw-org-row dw-org-invite-form">
            <input
              className="dw-input"
              type="email"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <button className="dw-btn" onClick={onInvite} disabled={busy || !inviteEmail.trim()}>
              Invite member
            </button>
          </div>
          {note ? <p className="dw-org-note">{note}</p> : null}

          {/* Collective builds */}
          <h3 className="dw-org-subhead">Shared builds</h3>
          {(dash?.builds.length ?? 0) === 0 ? (
            <p className="dw-panel-loading">No builds shared into this org yet.</p>
          ) : (
            <ul className="dw-org-builds">
              {dash?.builds.map((b) => (
                <li key={b.projectId} className="dw-org-build">
                  <a className="dw-org-build-name" href={`/app/builder/${b.projectId}`}>{b.name}</a>
                  <span className="dw-org-build-owner">{b.ownerName}</span>
                  <span className="dw-org-build-state">{b.buildState ?? 'draft'}</span>
                  <span className="dw-org-build-vis" data-vis={b.visibility}>{b.visibility}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="dw-panel-foot">
        Member management and seat billing are stubbed against real per-org data (E6);
        Stripe seat metering lands with the billing phase. Org membership is the only
        cross-user visibility — explicit and audited.
      </p>
    </section>
  );
}
