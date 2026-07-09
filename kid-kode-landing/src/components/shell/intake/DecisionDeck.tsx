'use client';

// PRISM SHELL — DECISION DECK (SHELL W2, spec §3 / S5)
//
// Phase 1 orchestration: a progress rail across the SIX interleaved cards, the
// active card, and the nav. Two streams (design ⇄ capability) are visible in
// the rail's colour coding. Every card is skippable, and "skip questions —
// just build" is reachable at all times — the deck is a guide, never a gate.

import { useEffect } from 'react';
import { useIntakeStore } from '@/lib/shell/intake/intake-store';
import { DECK } from '@/lib/shell/intake/intake-model';
import DecisionCard from './DecisionCard';

export default function DecisionDeck() {
  const cardIndex = useIntakeStore((s) => s.cardIndex);
  const answers = useIntakeStore((s) => s.answers);
  const nextCard = useIntakeStore((s) => s.nextCard);
  const prevCard = useIntakeStore((s) => s.prevCard);
  const skipCard = useIntakeStore((s) => s.skipCard);
  const goToBrief = useIntakeStore((s) => s.goToBrief);
  const fastForward = useIntakeStore((s) => s.fastForward);

  const card = DECK[cardIndex];
  const isLast = cardIndex === DECK.length - 1;

  // UXV-F4: each card retains the previous card's scroll offset, landing the
  // user mid-card with the question heading above the fold (worst on mobile).
  // Reset to the top on every card change.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [cardIndex]);

  const answeredCount = Object.values(answers).filter(
    (a) => a.skipped || (a.optionIds && a.optionIds.length) || (a.freeText && a.freeText.trim()),
  ).length;

  function advance() {
    if (isLast) goToBrief();
    else nextCard();
  }

  function onSkip() {
    skipCard(card.id);
    advance();
  }

  return (
    <div className="iv-phase iv-phase1">
      <div className="iv-deck-top">
        <ol className="iv-progress" aria-label="Build questions progress">
          {DECK.map((c, i) => {
            const a = answers[c.id];
            const done = a?.skipped || (a?.optionIds && a.optionIds.length) || (a?.freeText && a.freeText.trim());
            const state = i === cardIndex ? 'active' : done ? 'done' : 'todo';
            return (
              <li key={c.id} className="iv-progress-step" data-state={state} data-stream={c.stream}>
                <span className="iv-progress-bead" aria-hidden />
                <span className="iv-visually-hidden">
                  {c.stream} step {i + 1}: {state}
                </span>
              </li>
            );
          })}
        </ol>
        <button type="button" className="iv-fastlink" onClick={fastForward}>
          Skip questions — just build →
        </button>
      </div>

      <DecisionCard card={card} />

      <div className="iv-deck-nav">
        <button
          type="button"
          className="iv-navbtn"
          onClick={prevCard}
          disabled={cardIndex === 0}
        >
          ← Back
        </button>
        <span className="iv-deck-count" aria-live="polite">
          {answeredCount} of {DECK.length} answered
        </span>
        <div className="iv-deck-nav-right">
          <button type="button" className="iv-navbtn iv-skipbtn" onClick={onSkip}>
            Skip this question
          </button>
          <button type="button" className="iv-navbtn iv-nextbtn" onClick={advance}>
            {isLast ? 'Review your brief →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
