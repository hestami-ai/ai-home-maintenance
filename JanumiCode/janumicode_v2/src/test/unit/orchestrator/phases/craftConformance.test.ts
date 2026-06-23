import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { detectCraftConformance } from '../../../../lib/orchestrator/phases/craftConformance';

describe('detectCraftConformance', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  function write(rel: string, content: string): void {
    const full = path.join(root, 'src', rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }

  it('measures documented ratio, requirement citations, and uncommented files', () => {
    // Documented + cites a completion criterion.
    write('good.ts', [
      '/**',
      ' * Validate a 6-char slug.',
      ' * // CC-001: invalid slugs return 404.',
      ' */',
      'export function isValid(s: string): boolean { return /^[a-z]{6}$/.test(s); }',
    ].join('\n'));
    // Bare — two exported symbols, no comments, no citation.
    write('bare.ts', [
      'export const X = 1;',
      'export function noComment(): void {}',
    ].join('\n'));
    // Tests + .d.ts are excluded from the scan.
    write('good.test.ts', 'export const T = 1;');

    const r = detectCraftConformance(root);

    expect(r.filesScanned).toBe(2);                       // good.ts + bare.ts (test excluded)
    expect(r.exportedSymbols).toBe(3);                    // isValid, X, noComment
    expect(r.exportedSymbolsCommented).toBe(1);           // only isValid
    expect(r.documentedRatio).toBeCloseTo(1 / 3, 5);
    expect(r.filesCitingRequirements).toBe(1);            // good.ts
    expect(r.requirementCitations).toBeGreaterThanOrEqual(1);
    expect(r.uncommentedFiles).toBe(1);                   // bare.ts
  });

  it('returns a perfect ratio when there are no exported symbols (no false negatives)', () => {
    write('impl.ts', 'const internal = 1; function helper() { return internal; } helper();');
    const r = detectCraftConformance(root);
    expect(r.exportedSymbols).toBe(0);
    expect(r.documentedRatio).toBe(1);
  });
});
