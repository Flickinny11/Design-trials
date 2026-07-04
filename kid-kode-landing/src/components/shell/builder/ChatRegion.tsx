'use client';

// PRISM SHELL — CHAT AGENTIC LOOP (SHELL W1)
//
// The builder's left region: streamed assistant turns whose prose and tool
// steps interleave in arrival order (the E4 surface — W5 streams verification
// evidence into these steps), a composer with attachment staging, and a stop
// control that ACTUALLY aborts the stream — interruptible at all times, from
// the 3D send/stop object or the Escape key (spec §10 S4).

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { sendChatMessage, stopStreaming } from '@/lib/shell/agent-client';
import {
  useChatStore,
  type ChatToolStep,
  type ChatTurn,
} from '@/lib/shell/chat-store';
import { getModelById } from '@/lib/shell/model-config';

const SendButton3D = dynamic(() => import('./SendButton3D'), {
  ssr: false,
  loading: () => <div className="bw1-sendbtn" aria-hidden data-loading="true" />,
});

// ── Tool step (collapsible; auto-open while running) ─────────────────────────

const STEP_STATUS_LABEL: Record<ChatToolStep['status'], string> = {
  running: 'Running',
  ok: 'Done',
  error: 'Failed',
  stopped: 'Stopped',
};

function ToolStepRow({ step }: { step: ChatToolStep }) {
  // User toggle overrides the auto behavior once touched.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? step.status === 'running';
  const bodyRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [step.body, open]);

  return (
    <div className="bw1-step" data-status={step.status} data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="bw1-step-head"
        aria-expanded={open}
        onClick={() => setUserOpen(!open)}
      >
        <span className="bw1-step-bead" aria-hidden />
        <span className="bw1-step-title">{step.title}</span>
        {step.detail ? <span className="bw1-step-detail">{step.detail}</span> : null}
        <span className="bw1-step-status">{STEP_STATUS_LABEL[step.status]}</span>
        <span className="bw1-step-toggle" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <pre ref={bodyRef} className="bw1-step-body">
          {step.body || (step.status === 'running' ? '…' : '(no output)')}
        </pre>
      ) : null}
    </div>
  );
}

// ── One turn ─────────────────────────────────────────────────────────────────

function TurnView({ turn }: { turn: ChatTurn }) {
  const model = turn.modelId ? getModelById(turn.modelId) : undefined;
  return (
    <article className="bw1-turn" data-role={turn.role} data-status={turn.status}>
      <header className="bw1-turn-head">
        <span className="bw1-turn-who">{turn.role === 'user' ? 'You' : 'Prism'}</span>
        {turn.role === 'assistant' && model ? (
          <span className="bw1-turn-model">{model.label}</span>
        ) : null}
        {turn.status === 'streaming' ? (
          <span className="bw1-turn-chip bw1-turn-chip--live">
            <span className="bw1-turn-chip-bead" aria-hidden />
            Streaming
          </span>
        ) : null}
        {turn.status === 'interrupted' ? (
          <span className="bw1-turn-chip">Stopped by you</span>
        ) : null}
        {turn.status === 'error' ? (
          <span className="bw1-turn-chip bw1-turn-chip--error">Error</span>
        ) : null}
      </header>
      <div className="bw1-turn-body">
        {turn.segments.map((seg, i) =>
          seg.kind === 'text' ? (
            <p className="bw1-turn-text" key={`t-${i}`}>
              {seg.text}
              {turn.status === 'streaming' && i === turn.segments.length - 1 ? (
                <span className="bw1-caret" aria-hidden />
              ) : null}
            </p>
          ) : (
            <ToolStepRow key={seg.step.stepId} step={seg.step} />
          ),
        )}
        {turn.role === 'assistant' && turn.segments.length === 0 ? (
          <p className="bw1-turn-text bw1-turn-text--pending">
            <span className="bw1-caret" aria-hidden />
          </p>
        ) : null}
        {turn.errorMessage ? <p className="bw1-turn-error">{turn.errorMessage}</p> : null}
      </div>
      {turn.attachments && turn.attachments.length > 0 ? (
        <footer className="bw1-turn-attachments">
          {turn.attachments.map((a) => (
            <span key={a.name} className="bw1-attach-chip" data-static="true">
              {a.name}
            </span>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

// ── Region ───────────────────────────────────────────────────────────────────

export default function ChatRegion({ projectId }: { projectId: string }) {
  const turns = useChatStore((s) => s.turns);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const pendingAttachments = useChatStore((s) => s.pendingAttachments);
  const stageAttachment = useChatStore((s) => s.stageAttachment);
  const unstageAttachment = useChatStore((s) => s.unstageAttachment);

  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);

  // Follow the stream unless the user scrolled up to read.
  useEffect(() => {
    const el = listRef.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const onListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const send = useCallback(() => {
    const prompt = draft.trim();
    if (!prompt || isStreaming) return;
    setDraft('');
    nearBottom.current = true;
    void sendChatMessage({ projectId, prompt });
  }, [draft, isStreaming, projectId]);

  // Interruptible at all times: Escape aborts from anywhere in the region.
  useEffect(() => {
    if (!isStreaming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stopStreaming();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isStreaming]);

  return (
    <div className="bw1-chat-inner">
      <header className="bw1-region-head">
        <span className="bw1-region-kicker">Build chat</span>
        <span className="bw1-region-note">Echo agent · W1 — orchestrator lands in W5</span>
      </header>

      <div className="bw1-turns" ref={listRef} onScroll={onListScroll} aria-live="polite">
        {turns.length === 0 ? (
          <div className="bw1-chat-empty">
            <p className="bw1-chat-empty-title">Tell Prism what to build.</p>
            <p className="bw1-chat-empty-body">
              The agent streams its thinking and its tool steps here — every step is
              inspectable, and you can stop it at any moment. In W5 the Verify phase will
              stream its evidence into these same steps.
            </p>
          </div>
        ) : (
          turns.map((t) => <TurnView key={t.id} turn={t} />)
        )}
      </div>

      <div className="bw1-composer">
        {pendingAttachments.length > 0 ? (
          <div className="bw1-attach-row">
            {pendingAttachments.map((a) => (
              <span key={a.name} className="bw1-attach-chip">
                {a.name}
                <button
                  type="button"
                  className="bw1-attach-remove"
                  aria-label={`Remove attachment ${a.name}`}
                  onClick={() => unstageAttachment(a.name)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="bw1-composer-row">
          <textarea
            ref={textRef}
            className="bw1-input"
            value={draft}
            placeholder="Describe a change…"
            rows={2}
            aria-label="Message the build agent"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <SendButton3D
            streaming={isStreaming}
            disabled={draft.trim().length === 0}
            onSend={send}
            onStop={stopStreaming}
          />
        </div>
        <div className="bw1-composer-meta">
          <button
            type="button"
            className="bw1-minibtn"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach files (metadata only in W1)"
          >
            Attach
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="bw1-visually-hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              for (const f of Array.from(e.target.files ?? [])) {
                stageAttachment({
                  name: f.name,
                  sizeBytes: f.size,
                  mimeType: f.type || undefined,
                });
              }
              e.target.value = '';
            }}
          />
          <span className="bw1-composer-hint">
            Enter sends · Shift+Enter newline{isStreaming ? ' · Esc stops' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
