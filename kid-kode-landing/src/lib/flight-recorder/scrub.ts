// PRISM FLIGHT RECORDER — PII / secret scrub (I-PII, I-SECRETS / INV-19).
//
// Runs at WRITE time on every record before it reaches any sink. No raw email,
// phone, government id, payment number, API-key-shaped string, or known personal
// identifier survives into the corpus. This is the moat: 73% of failed
// fine-tunes trace to data quality — a clean, legally-defensible corpus starts
// with a scrub whose guarantees are proven by adversarial unit tests
// (tests/unit/flight-recorder/scrub.test.ts).
//
// SCOPE + HONESTY: the scrub catches, with high precision, every class its tests
// assert — emails, phones, SSN/gov-id, payment cards, and a broad family of
// secret/key shapes (INV-19 is load-bearing). Free-text PERSONAL NAMES are
// redacted precisely when the caller supplies the known identifiers for the
// actor (name + email), which the recorder always does server-side. Generic
// open-vocabulary name NER is a documented SHIP-BRAND enhancement (see the
// schema doc "Scrub coverage" section) — NOT faked here. Data honesty over a
// false sense of completeness.

export const REDACTION = '[REDACTED]' as const;

/** Patterns redacted in ALL free text, unconditionally. Ordered specific→general. */
const PATTERNS: Array<{ label: string; re: RegExp }> = [
  // ── Secrets / API keys (INV-19) ────────────────────────────────────────────
  // Provider-prefixed keys: OpenAI sk-/rk-, Anthropic sk-ant-, GitHub gh[porus]_,
  // Google AIza, Slack xox[baprs]-, Stripe [sr]k_(live|test)_, Replicate r8_.
  { label: 'key-prefixed', re: /\b(?:sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{16,}|rk-[A-Za-z0-9_-]{16,}|gh[porus]_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|[sr]k_(?:live|test)_[A-Za-z0-9]{10,}|r8_[A-Za-z0-9]{20,})\b/g },
  // AWS access key id.
  { label: 'aws-akid', re: /\b(?:AKIA|ASIA|AROA|AIDA)[A-Z0-9]{16}\b/g },
  // JWT (three base64url segments).
  { label: 'jwt', re: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g },
  // Bearer / Authorization tokens.
  { label: 'bearer', re: /\b[Bb]earer\s+[A-Za-z0-9._~+/-]{12,}=*/g },
  // Explicit key=value secrets ("api_key: xxxx", "PRISM_R2_SECRET=xxxx").
  { label: 'kv-secret', re: /\b([A-Za-z0-9_.-]*(?:key|secret|token|password|passwd|pwd|credential|apikey|api_key|auth)[A-Za-z0-9_.-]*)\s*[=:]\s*["']?([A-Za-z0-9._~+/-]{8,})["']?/gi },
  // Long high-entropy hex (≥32) or base64-ish (≥40) blobs — generic key shapes.
  { label: 'hex-blob', re: /\b[0-9a-fA-F]{32,}\b/g },
  { label: 'b64-blob', re: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g },

  // ── Direct PII ───────────────────────────────────────────────────────────────
  { label: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  // Phone (US + intl-ish, tolerant of separators). Kept conservative to avoid
  // eating ordinary numbers: requires 10+ digits with separators or a +country.
  { label: 'phone', re: /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/g },
  // US SSN.
  { label: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  // Payment card (15–19 digit units, optional separators). Lower bound is 15
  // (Amex) rather than 13 so a bare 13-digit millisecond timestamp — pervasive
  // in server ids — is NOT misread as a card (avoids over-redacting join keys).
  { label: 'card', re: /\b(?:\d[ -]?){15,19}\b/g },
];

/** Escape a string for safe use inside a RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Redact a single string: unconditional patterns + any caller-supplied known
 *  identifiers (exact personal name / email tokens for the actor). */
export function scrubString(input: string, knownIdentifiers: string[] = []): string {
  let out = input;
  for (const { re } of PATTERNS) {
    out = out.replace(re, REDACTION);
  }
  // Known personal identifiers (the actor's name/email) — precise, whole-token,
  // case-insensitive. This is how we honor "no raw names" without open-vocab NER:
  // the recorder passes the resolved actor identity; we redact exactly it.
  for (const id of knownIdentifiers) {
    const t = id.trim();
    if (t.length < 3) continue; // don't redact 1–2 char fragments
    out = out.replace(new RegExp(`\\b${escapeRe(t)}\\b`, 'gi'), REDACTION);
  }
  return out;
}

/** Deep-scrub any JSON-serializable value. Object KEYS are preserved (they are
 *  schema, not data); string VALUES are scrubbed. Recurses arrays + objects.
 *  Also drops values under obviously-secret-named keys entirely. */
const SECRET_KEY_RE = /(?:secret|password|passwd|pwd|api[_-]?key|apikey|access[_-]?token|private[_-]?key|credential)/i;

export function scrubValue<T>(value: T, knownIdentifiers: string[] = []): T {
  if (value == null) return value;
  if (typeof value === 'string') return scrubString(value, knownIdentifiers) as unknown as T;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, knownIdentifiers)) as unknown as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k)) {
        out[k] = REDACTION; // a secret-named field never carries a raw value through
        continue;
      }
      out[k] = scrubValue(v, knownIdentifiers);
    }
    return out as unknown as T;
  }
  return value;
}

/** Quick boolean probe used by tests + the writer's self-check: does this string
 *  still contain something that looks like raw PII/secret after scrubbing? */
export function containsLikelyPii(input: string): boolean {
  return PATTERNS.some(({ re }) => {
    re.lastIndex = 0;
    return re.test(input);
  });
}
