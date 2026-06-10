// Text System P1/A1 — DOM-free discipline (FP-05 hygiene).
// No document.* / window.* anywhere under src/lib/prism/text/.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const textDir = fileURLToPath(new URL('../../src/lib/prism/text', import.meta.url));

describe('text system DOM discipline', () => {
  it('contains no document./window. references', () => {
    const files = readdirSync(textDir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(4); // contract + the 3 A1 modules
    for (const file of files) {
      const source = readFileSync(join(textDir, file), 'utf8');
      expect(source, `${file} must not touch document.*`).not.toMatch(/\bdocument\./);
      expect(source, `${file} must not touch window.*`).not.toMatch(/\bwindow\./);
    }
  });
});
