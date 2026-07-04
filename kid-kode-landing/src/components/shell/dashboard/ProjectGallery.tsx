'use client';

// PRISM SHELL — PROJECT GALLERY (SHELL W4, S3)
//
// The shelf of the tenant's projects. Each card carries a REAL 3D thumbnail
// (GalleryThumbs3D overlays the grid — one GL context, DL8) and a signature
// jewel derived from the project (project-signature.ts). Open → builder (W1);
// rename inline; duplicate (one call); delete (confirm). History opens the E1
// timeline. Cards are the DOM hit layer above the shared thumbnail canvas; the
// two share a JS-driven column count so minis stay pinned to their cards at
// every breakpoint.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PrismProject } from '../../../../packages/shared-interfaces/src/prism-tenancy';
import {
  deleteProject,
  duplicateProject,
  renameProject,
} from '@/lib/shell/tenancy-client';
import { projectSignature } from '@/lib/shell/project-signature';
import ConfirmDialog from './ConfirmDialog';
import GalleryThumbs3D from './GalleryThumbs3D';

function useColumns(count: number): number {
  const [cols, setCols] = useState(1);
  useEffect(() => {
    function compute() {
      const w = window.innerWidth;
      const max = w <= 640 ? 1 : w <= 1024 ? 2 : 3;
      setCols(Math.max(1, Math.min(max, count || 1)));
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [count]);
  return cols;
}

const BUILD_LABEL: Record<string, string> = {
  intake: 'Intake',
  'plan-pending': 'Plan pending',
  planning: 'Planning',
  building: 'Building',
  built: 'Built',
};

export default function ProjectGallery({
  projects,
  onChanged,
  onOpenHistory,
}: {
  projects: PrismProject[];
  onChanged: () => void;
  onOpenHistory: (project: PrismProject) => void;
}) {
  const router = useRouter();
  const cols = useColumns(projects.length);
  const [hovered, setHovered] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PrismProject | null>(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss an open kebab menu on outside click / Escape.
  useEffect(() => {
    if (!menuId) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuId(null);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuId]);

  function open(p: PrismProject) {
    router.push(`/app/builder/${p.id}`);
  }

  function startRename(p: PrismProject) {
    setMenuId(null);
    setEditingId(p.id);
    setDraftName(p.name);
  }

  async function commitRename(p: PrismProject) {
    const name = draftName.trim();
    setEditingId(null);
    if (!name || name === p.name) return;
    try {
      await renameProject(p.id, name);
      onChanged();
    } catch {
      /* surfaced by refetch; keep the card */
    }
  }

  async function duplicate(p: PrismProject) {
    setMenuId(null);
    try {
      await duplicateProject(p.id);
      onChanged();
    } catch {
      /* ignore — refetch shows current truth */
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteProject(pendingDelete.id);
      setPendingDelete(null);
      onChanged();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dw-gallery" style={{ ['--dw-cols' as string]: cols }}>
      <GalleryThumbs3D
        projectIds={projects.map((p) => p.id)}
        cols={cols}
        hoveredIndex={hovered}
      />
      <ul className="dw-cards">
        {projects.map((p, i) => {
          const sig = projectSignature(p.id);
          const editing = editingId === p.id;
          return (
            <li
              key={p.id}
              className="dw-card"
              data-hover={hovered === i ? 'true' : 'false'}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            >
              {/* Thumbnail band — the shared 3D canvas renders the mini here. */}
              <button
                type="button"
                className="dw-card-thumb"
                aria-label={`Open ${p.name}`}
                onClick={() => open(p)}
              >
                <span
                  className="dw-card-jewel"
                  aria-hidden
                  style={{ background: sig.accent }}
                />
                {p.buildState ? (
                  <span className="dw-card-state" data-state={p.buildState}>
                    {BUILD_LABEL[p.buildState] ?? p.buildState}
                  </span>
                ) : null}
              </button>

              <div className="dw-card-body">
                {editing ? (
                  <input
                    className="dw-input dw-card-rename"
                    value={draftName}
                    autoFocus
                    aria-label="Rename project"
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => void commitRename(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename(p);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="dw-card-name"
                    onClick={() => open(p)}
                  >
                    {p.name}
                  </button>
                )}
                <span className="dw-card-meta">
                  {new Date(p.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' · '}
                  {p.id.slice(0, 9)}
                </span>
              </div>

              {/* Card actions (kebab) */}
              <div className="dw-card-kebab-wrap">
                <button
                  type="button"
                  className="dw-card-kebab"
                  aria-label={`Actions for ${p.name}`}
                  aria-haspopup="menu"
                  aria-expanded={menuId === p.id}
                  onClick={() => setMenuId(menuId === p.id ? null : p.id)}
                >
                  <span aria-hidden>⋯</span>
                </button>
                {menuId === p.id ? (
                  <div ref={menuRef} className="dw-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => startRename(p)}>
                      Rename
                    </button>
                    <button type="button" role="menuitem" onClick={() => void duplicate(p)}>
                      Duplicate
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuId(null);
                        onOpenHistory(p);
                      }}
                    >
                      History
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      data-danger="true"
                      onClick={() => {
                        setMenuId(null);
                        setPendingDelete(p);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this project?"
          body={`"${pendingDelete.name}" and its graph, checkpoints, and assets are permanently removed. This can't be undone.`}
          confirmLabel="Delete"
          danger
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}
