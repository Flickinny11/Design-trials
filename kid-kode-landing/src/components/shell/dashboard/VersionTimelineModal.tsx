'use client';

// PRISM SHELL — E1 VERSION TIMELINE (SHELL W4)
//
// Per-project checkpoint history as .prism graph SNAPSHOTS (E1). Save a named
// checkpoint; restore any prior one with a confirm + a re-verify hook — after
// the server copies the snapshot back onto the live graph, the client re-reads
// the graph and asserts the round-trip landed (byte-equal) before declaring the
// restore verified. Project-scale undo, runtime-native. Focus-trapped modal
// (WCAG 2.2); clean-but-premium working surface (Decision A).

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PrismProject,
  PrismProjectVersion,
} from '../../../../packages/shared-interfaces/src/prism-tenancy';
import {
  createVersion,
  getGraph,
  listVersions,
  restoreVersion,
} from '@/lib/shell/tenancy-client';
import ConfirmDialog from './ConfirmDialog';

type RestoreState =
  | { phase: 'idle' }
  | { phase: 'confirm'; version: PrismProjectVersion }
  | { phase: 'working'; version: PrismProjectVersion }
  | { phase: 'done'; versionId: string; verified: boolean };

export default function VersionTimelineModal({
  project,
  onClose,
}: {
  project: PrismProject;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [versions, setVersions] = useState<PrismProjectVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [restore, setRestore] = useState<RestoreState>({ phase: 'idle' });

  const refresh = useCallback(async () => {
    try {
      setVersions(await listVersions(project.id));
    } catch {
      setError('Could not load history.');
    }
  }, [project.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Focus + trap + Escape.
  useEffect(() => {
    ref.current?.focus();
    function focusables(): HTMLElement[] {
      const root = ref.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        ),
      );
    }
    function onKey(e: KeyboardEvent) {
      if (restore.phase === 'confirm' || restore.phase === 'working') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, restore.phase]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await createVersion(project.id, label.trim() || 'Checkpoint');
      setLabel('');
      await refresh();
    } catch {
      setError('Could not save the checkpoint.');
    } finally {
      setSaving(false);
    }
  }

  async function doRestore(version: PrismProjectVersion) {
    setRestore({ phase: 'working', version });
    setError(null);
    try {
      const out = await restoreVersion(project.id, version.id);
      // Re-verify hook: re-read the live graph and assert the snapshot landed.
      const live = await getGraph(project.id);
      const verified = JSON.stringify(live) === JSON.stringify(out.graph);
      setRestore({ phase: 'done', versionId: version.id, verified });
      await refresh();
    } catch {
      setError('Restore failed.');
      setRestore({ phase: 'idle' });
    }
  }

  const list = versions ?? [];

  return (
    <div className="dw-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={ref}
        className="dw-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Version history — ${project.name}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dw-modal-head">
          <div>
            <p className="dw-modal-kicker">VERSION TIMELINE · E1</p>
            <h2 className="dw-modal-title">{project.name}</h2>
          </div>
          <button
            type="button"
            className="dw-btn dw-btn-ghost"
            onClick={onClose}
            aria-label="Close history"
          >
            Close
          </button>
        </header>

        <div className="dw-vt-save">
          <input
            className="dw-input"
            type="text"
            value={label}
            placeholder="Name this checkpoint"
            aria-label="Checkpoint name"
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
            disabled={saving}
          />
          <button
            type="button"
            className="dw-btn"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save checkpoint'}
          </button>
        </div>

        {error ? (
          <p className="dw-error" role="alert">
            {error}
          </p>
        ) : null}

        {list.length === 0 ? (
          <p className="dw-vt-empty">
            No checkpoints yet. Save one above — each is a full graph snapshot
            you can restore with one click.
          </p>
        ) : (
          <ol className="dw-vt-list">
            {[...list].reverse().map((v) => {
              const done = restore.phase === 'done' && restore.versionId === v.id;
              return (
                <li key={v.id} className="dw-vt-row">
                  <span className="dw-vt-dot" aria-hidden />
                  <span className="dw-vt-meta">
                    <span className="dw-vt-label">{v.label}</span>
                    <span className="dw-vt-when">
                      {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </span>
                  {done ? (
                    <span
                      className="dw-vt-verified"
                      data-ok={restore.verified ? 'true' : 'false'}
                      role="status"
                    >
                      {restore.verified ? 'Restored · verified' : 'Restored'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="dw-btn dw-btn-sm"
                      onClick={() => setRestore({ phase: 'confirm', version: v })}
                    >
                      Restore
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {restore.phase === 'confirm' || restore.phase === 'working' ? (
        <ConfirmDialog
          title="Restore this checkpoint?"
          body={`This replaces the current graph of "${project.name}" with the snapshot "${restore.version.label}". The live graph is overwritten; save a checkpoint first if you want to keep it.`}
          confirmLabel="Restore"
          busy={restore.phase === 'working'}
          onConfirm={() => void doRestore(restore.version)}
          onCancel={() => setRestore({ phase: 'idle' })}
        />
      ) : null}
    </div>
  );
}
