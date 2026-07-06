'use client';

// PRISM SHELL — DECISION CARD (SHELL W2, spec §3 / S5 / I6)
//
// One card of the guided deck. Body varies by kind — visual option glyphs, the
// 3D Direction Boards, or brand-mark capability tiles — but EVERY card carries
// the two universal affordances (S5): a free-text escape hatch ("describe your
// own", I6) and Skip. A card is never a dead end and never an interrogation.

import { useState } from 'react';
import { useIntakeStore } from '@/lib/shell/intake/intake-store';
import {
  DEPLOY_OPTIONS,
  type CardDef,
} from '@/lib/shell/intake/intake-model';
import CardOptions3D from './CardOptions3D';
import DirectionBoards3D from './DirectionBoards3D';
import BrandTiles3D, { type BrandTile } from './BrandTiles3D';
import GithubImportPanel from './GithubImportPanel';

export default function DecisionCard({ card }: { card: CardDef }) {
  const answer = useIntakeStore((s) => s.answers[card.id]);
  const toggleOption = useIntakeStore((s) => s.toggleOption);
  const setFreeText = useIntakeStore((s) => s.setFreeText);
  const chosenDirectionId = useIntakeStore((s) => s.chosenDirectionId);
  const chooseDirection = useIntakeStore((s) => s.chooseDirection);
  const integrations = useIntakeStore((s) => s.integrations);
  const toggleIntegration = useIntakeStore((s) => s.toggleIntegration);
  const requestConnector = useIntakeStore((s) => s.requestConnector);
  const githubImport = useIntakeStore((s) => s.githubImport);
  const setGithub = useIntakeStore((s) => s.setGithub);
  const deployTarget = useIntakeStore((s) => s.deployTarget);
  const setDeploy = useIntakeStore((s) => s.setDeploy);

  const [connectAnything, setConnectAnything] = useState('');

  const escapeHatchLabel =
    card.kind === 'direction'
      ? 'Describe a different direction'
      : card.stream === 'capability'
        ? 'Describe another need or integration'
        : 'Describe your own';

  return (
    <div className="iv-card" data-stream={card.stream} data-skipped={answer?.skipped ? 'true' : 'false'}>
      <div className="iv-card-head">
        <p className="iv-kicker" data-stream={card.stream}>
          {card.kicker}
        </p>
        <h2 className="iv-card-q">{card.question}</h2>
        <p className="iv-card-helper">{card.helper}</p>
      </div>

      <div className="iv-card-body">
        {card.kind === 'options' && card.options ? (
          <CardOptions3D
            options={card.options}
            selectedIds={answer?.optionIds ?? []}
            onToggle={(id) => toggleOption(card.id, id, Boolean(card.multi))}
          />
        ) : null}

        {card.kind === 'direction' ? (
          <DirectionBoards3D selectedId={chosenDirectionId} onSelect={chooseDirection} />
        ) : null}

        {card.kind === 'capability-tiles' && card.options ? (
          <div className="iv-connect">
            <div className="iv-connect-section">
              <p className="iv-connect-label">One-click integrations</p>
              <BrandTiles3D
                ariaLabel="Choose integrations"
                tiles={card.options.map((o): BrandTile => ({
                  id: o.id,
                  mark: o.brandMark ?? 'prism',
                  label: o.label,
                  hint: o.hint,
                }))}
                selectedIds={card.options
                  .filter((o) => integrations.some((i) => i.providerId === o.providerId))
                  .map((o) => o.id)}
                onToggle={(id) => {
                  const opt = card.options?.find((o) => o.id === id);
                  if (opt?.providerId) toggleIntegration({ providerId: opt.providerId, label: opt.label });
                }}
              />
            </div>

            <div className="iv-connect-anything">
              <input
                type="text"
                className="iv-url-input"
                value={connectAnything}
                placeholder="Connect anything — name a platform (Notion, Linear, your API…)"
                onChange={(e) => setConnectAnything(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  (e.preventDefault(), (requestConnector(connectAnything), setConnectAnything('')))
                }
                aria-label="Request a connector for any platform"
              />
              <button
                type="button"
                className="iv-url-read"
                disabled={!connectAnything.trim()}
                onClick={() => {
                  requestConnector(connectAnything);
                  setConnectAnything('');
                }}
              >
                Request
              </button>
            </div>
            {integrations.some((i) => i.requested) ? (
              <p className="iv-connect-note">
                Prism will author connectors for:{' '}
                {integrations.filter((i) => i.requested).map((i) => i.label).join(', ')}
              </p>
            ) : null}

            <div className="iv-connect-section iv-connect-github">
              <label className="iv-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(githubImport?.requested)}
                  onChange={(e) => setGithub(e.target.checked, githubImport?.repo)}
                />
                <span>Import an existing GitHub repo</span>
              </label>
              {githubImport?.requested ? <GithubImportPanel /> : null}
            </div>

            <div className="iv-connect-section">
              <p className="iv-connect-label">Deploy target</p>
              <BrandTiles3D
                ariaLabel="Choose a deploy target"
                tiles={DEPLOY_OPTIONS.map((d): BrandTile => ({ id: d.id, mark: d.mark, label: d.label }))}
                selectedIds={[deployTarget]}
                onToggle={(id) => setDeploy(id as typeof deployTarget)}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="iv-card-escape">
        <label className="iv-field">
          <span className="iv-field-label">{escapeHatchLabel}</span>
          <textarea
            className="iv-textarea iv-textarea-sm"
            rows={2}
            value={answer?.freeText ?? ''}
            placeholder="In your own words — Prism reads this too."
            onChange={(e) => setFreeText(card.id, e.target.value)}
            aria-label={escapeHatchLabel}
          />
        </label>
      </div>
    </div>
  );
}
