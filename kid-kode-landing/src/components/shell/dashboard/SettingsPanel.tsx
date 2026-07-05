'use client';

// PRISM SHELL — SETTINGS PANEL (SHELL W4 → W7)
//
// Settings depth (W7): profile · persisted default build model (7.2/7.4) ·
// notification prefs · organization/plan · usage shortcut · danger zone. Model
// availability comes from the single config source (never a hardcoded string);
// the chosen default now PERSISTS via tenancy.settings. Clean-but-premium
// working surface (Decision A).

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PrismAccountSettings,
  PrismNotificationPrefs,
} from '../../../../packages/shared-interfaces/src/prism-tenancy';
import { getModelRegistry, getDefaultModel } from '@/lib/shell/model-config';
import { deleteAccount, getSettings, setSettings } from '@/lib/shell/tenancy-client';
import { signOut } from '@/lib/shell/auth-client';

const NOTIF_LABELS: Record<keyof PrismNotificationPrefs, string> = {
  buildComplete: 'A build finishes or fails',
  shareInvites: 'I am invited to an org or project',
  productUpdates: 'Product updates & new capabilities',
};

export default function SettingsPanel({
  userName,
  userEmail,
  planTier,
}: {
  userName: string;
  userEmail: string;
  planTier: string;
}) {
  const models = useMemo(() => getModelRegistry(), []);
  const [modelId, setModelId] = useState(() => getDefaultModel().id);
  const [notifs, setNotifs] = useState<PrismNotificationPrefs | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s: PrismAccountSettings = await getSettings();
        if (!alive) return;
        if (s.defaultModelId) setModelId(s.defaultModelId);
        setNotifs(s.notifications);
      } catch {
        setNotifs({ buildComplete: true, shareInvites: true, productUpdates: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onModelChange = useCallback(async (id: string) => {
    setModelId(id);
    try {
      await setSettings({ defaultModelId: id });
      setSavedNote('Default model saved.');
      setTimeout(() => setSavedNote(null), 2200);
    } catch {
      setSavedNote('Could not save.');
    }
  }, []);

  const onToggleNotif = useCallback(
    async (key: keyof PrismNotificationPrefs, value: boolean) => {
      setNotifs((cur) => (cur ? { ...cur, [key]: value } : cur));
      try {
        await setSettings({ notifications: { [key]: value } });
      } catch {
        /* revert-on-fail kept simple: next load reconciles */
      }
    },
    [],
  );

  const onDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await deleteAccount(confirmName);
      if (res.deleted) {
        await signOut();
        window.location.href = '/sign-in';
      } else {
        setSavedNote('Delete failed.');
        setDeleting(false);
      }
    } catch {
      setSavedNote('Name did not match.');
      setDeleting(false);
    }
  }, [confirmName]);

  return (
    <section className="dw-panel" aria-labelledby="dw-settings-h">
      <div className="dw-panel-head">
        <div>
          <p className="dw-panel-kicker">SETTINGS</p>
          <h2 id="dw-settings-h" className="dw-panel-title">Account &amp; defaults</h2>
        </div>
        <span className="dw-tier" data-tier={planTier}>{planTier.toUpperCase()}</span>
      </div>

      {/* Profile */}
      <h3 className="dw-org-subhead">Profile</h3>
      <dl className="dw-settings-list">
        <div className="dw-settings-row"><dt>Name</dt><dd>{userName}</dd></div>
        <div className="dw-settings-row"><dt>Email</dt><dd>{userEmail}</dd></div>
        <div className="dw-settings-row"><dt>Plan</dt><dd>{planTier}</dd></div>
        <div className="dw-settings-row">
          <dt><label htmlFor="dw-model">Default build model</label></dt>
          <dd>
            <select
              id="dw-model"
              className="dw-select"
              value={modelId}
              onChange={(e) => onModelChange(e.target.value)}
            >
              {models.map((mdl) => (
                <option key={mdl.id} value={mdl.id} disabled={mdl.status !== 'active'}>
                  {mdl.label}{mdl.status === 'gated' ? ' — request access' : ''}
                </option>
              ))}
            </select>
            {savedNote ? <span className="dw-settings-saved">{savedNote}</span> : null}
          </dd>
        </div>
      </dl>

      {/* Notifications */}
      <h3 className="dw-org-subhead">Notifications</h3>
      <ul className="dw-notif-list">
        {(Object.keys(NOTIF_LABELS) as (keyof PrismNotificationPrefs)[]).map((key) => (
          <li key={key} className="dw-notif-row">
            <label className="dw-notif-label" htmlFor={`dw-notif-${key}`}>{NOTIF_LABELS[key]}</label>
            <input
              id={`dw-notif-${key}`}
              type="checkbox"
              className="dw-toggle"
              checked={notifs ? notifs[key] : false}
              onChange={(e) => onToggleNotif(key, e.target.checked)}
              disabled={!notifs}
            />
          </li>
        ))}
      </ul>

      {/* Organization */}
      <h3 className="dw-org-subhead">Organization</h3>
      {planTier === 'enterprise' ? (
        <p className="dw-settings-org">
          Manage seats, members, and shared builds in{' '}
          <a className="dw-inline-link" href="/app?panel=org">Team →</a>
        </p>
      ) : (
        <p className="dw-settings-org">
          Enterprise unlocks organizations, shared builds, and live multiplayer
          co-editing. Individual accounts stay fully private and isolated.
        </p>
      )}

      <div className="dw-settings-links">
        <a className="dw-btn dw-btn-ghost" href="/app?panel=usage">Usage &amp; limits</a>
        <a className="dw-btn dw-btn-ghost" href="/app/integrations">Manage integrations</a>
      </div>

      {/* Danger zone */}
      <h3 className="dw-org-subhead dw-danger-head">Danger zone</h3>
      {!dangerOpen ? (
        <button className="dw-btn" data-danger="true" onClick={() => setDangerOpen(true)}>
          Delete account &amp; all data…
        </button>
      ) : (
        <div className="dw-danger">
          <p className="dw-danger-lead">
            This permanently deletes <strong>all your Prism projects, graphs, versions,
            and assets</strong>. It cannot be undone. Type your name (<em>{userName}</em>)
            to confirm.
          </p>
          <div className="dw-org-row">
            <input
              className="dw-input"
              placeholder={userName}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
            <button
              className="dw-btn"
              data-danger="true"
              onClick={onDelete}
              disabled={deleting || confirmName.trim() !== userName.trim()}
            >
              {deleting ? 'Deleting…' : 'Delete everything'}
            </button>
            <button className="dw-btn dw-btn-ghost" onClick={() => setDangerOpen(false)} disabled={deleting}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="dw-panel-foot">
        Model availability is config-driven — no hardcoded model. Billing &amp; API keys
        arrive with the deploy &amp; billing phase.
      </p>
    </section>
  );
}
