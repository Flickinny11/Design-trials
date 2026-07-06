// I-PII / I-SECRETS (INV-19) — adversarial scrub proof.
// If any of these fixtures survive scrubbing, the corpus is legally poisoned and
// a secret could leak into the training sink. These assertions are the moat.

import { describe, it, expect } from 'vitest';
import { scrubString, scrubValue, containsLikelyPii, REDACTION } from '@/lib/flight-recorder/scrub';

describe('flight-recorder scrub — secrets (INV-19)', () => {
  // Fixtures are ASSEMBLED AT RUNTIME from split parts + synthetic bodies so no
  // full real-looking token literal is committed to source — GitHub push
  // protection scans file text and flags a token shape even in a test. The
  // scrub regexes still match the assembled (contiguous) runtime string.
  const body = (n: number) => 'A'.repeat(n);
  const SECRETS: Array<[string, string]> = [
    ['OpenAI key', 'here is ' + 'sk-' + 'proj-' + body(40) + ' for you'],
    ['Anthropic key', 'ANTHROPIC_API_KEY=' + 'sk-' + 'ant-' + 'api03-' + body(40)],
    ['GitHub token', 'token ' + 'gh' + 'p_' + body(36)],
    ['AWS access key', 'aws ' + 'AK' + 'IA' + '0'.repeat(16) + ' creds'],
    ['Google API key', 'AI' + 'za' + body(35) + ' key'],
    ['Slack token', 'xo' + 'xb-' + '000000000000-000000000000-' + body(24)],
    ['Stripe live key', 's' + 'k_' + 'live_' + body(24)],
    ['Replicate token', 'r' + '8_' + body(37)],
    ['JWT', 'Bearer ' + 'eyJ' + body(10) + '.' + 'eyJ' + body(10) + '.' + body(30)],
    ['kv secret', 'db_password: ' + body(16)],
    ['hex blob', 'sig=' + 'de' + 'adbeef'.repeat(6)],
  ];

  for (const [label, input] of SECRETS) {
    it(`redacts ${label}`, () => {
      const out = scrubString(input);
      expect(out).toContain(REDACTION);
      expect(containsLikelyPii(out)).toBe(false);
    });
  }
});

describe('flight-recorder scrub — direct PII', () => {
  const PII: Array<[string, string]> = [
    ['email', 'contact me at jane.doe+test@example.co.uk please'],
    ['phone', 'call (415) 555-0132 tomorrow'],
    ['SSN', 'ssn 123-45-6789 on file'],
    ['credit card', 'card 4111 1111 1111 1111 exp'],
  ];
  for (const [label, input] of PII) {
    it(`redacts ${label}`, () => {
      const out = scrubString(input);
      expect(out).toContain(REDACTION);
      expect(containsLikelyPii(out)).toBe(false);
    });
  }
});

describe('flight-recorder scrub — known personal identifiers (names)', () => {
  it('redacts the actor name + email when supplied, without open-vocab NER', () => {
    const text = 'Logan Baird asked to make the dial rose gold; ping logantbaird@gmail.com.';
    const out = scrubString(text, ['Logan Baird', 'logantbaird@gmail.com']);
    expect(out).not.toContain('Logan Baird');
    expect(out).not.toContain('logantbaird');
    // Non-PII design language survives — no over-redaction.
    expect(out).toContain('rose gold');
  });
});

describe('flight-recorder scrub — structural preservation', () => {
  it('preserves object keys + numbers; drops secret-named field values; scrubs string values deep', () => {
    const rec = {
      schema_version: 'prism-fr-v1',
      'prism.swe_rm.score': 0.87,
      apiKey: 'sk-' + 'ant-' + 'api03-' + 'SHOULD-BE-DROPPED-' + '0'.repeat(20),
      spec: { caption: 'call jane@example.com about it', subtype: 'watch-dial' },
      nested: [{ email: 'x@y.com' }, 42, true],
    };
    const out = scrubValue(rec) as typeof rec;
    // keys intact
    expect(out.schema_version).toBe('prism-fr-v1');
    expect(out['prism.swe_rm.score']).toBe(0.87);
    // secret-named key value dropped
    expect(out.apiKey).toBe(REDACTION);
    // deep string value scrubbed, non-PII text kept
    expect(out.spec.caption).toContain(REDACTION);
    expect(out.spec.caption).toContain('about it');
    expect(out.spec.subtype).toBe('watch-dial');
    // deep array scrub + primitives preserved
    expect((out.nested[0] as { email: string }).email).toBe(REDACTION);
    expect(out.nested[1]).toBe(42);
    expect(out.nested[2]).toBe(true);
  });
});
