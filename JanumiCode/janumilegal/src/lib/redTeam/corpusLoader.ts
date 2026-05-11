/**
 * Red-team corpus loader (Wave 13).
 *
 * Reads fixtures from `test-and-evaluation/red-team-corpus/<family>/<id>.md`.
 * Each fixture has YAML-ish frontmatter declaring expected outcome and
 * an attack family. The loader returns a typed CorpusFixture array.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AdmissionDecision, AttackFamily } from './types.js';
import type { Severity } from '../reasoningReview/types.js';

export interface CorpusFixture {
  readonly path: string;
  readonly attackFamily: AttackFamily;
  readonly attackId: string;
  readonly expectedOutcome: AdmissionDecision;
  readonly expectedValidator: string;
  readonly expectedSeverity: Severity;
  readonly notes: string;
  readonly content: string;
}

const FAMILIES: readonly AttackFamily[] = [
  'source-injection',
  'encoding-obfuscation',
  'citation-poisoning',
  'output-exfiltration',
  'privilege-confusion',
  'reviewer-co-option',
];

export function loadCorpus(corpusRoot: string): CorpusFixture[] {
  const fixtures: CorpusFixture[] = [];
  for (const family of FAMILIES) {
    const dir = path.join(corpusRoot, family);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.md')) continue;
      const filePath = path.join(dir, entry);
      const raw = fs.readFileSync(filePath, 'utf8');
      const fixture = parseFixture(filePath, raw);
      if (fixture) fixtures.push(fixture);
    }
  }
  return fixtures;
}

function parseFixture(filePath: string, raw: string): CorpusFixture | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!m) return null;
  const [, frontmatter, body] = m;
  const fields: Record<string, string> = {};
  let currentKey: string | null = null;
  let multiline = '';
  for (const line of frontmatter.split(/\r?\n/)) {
    if (currentKey && (line.startsWith('  ') || line === '')) {
      multiline += (multiline ? '\n' : '') + line.replace(/^  /, '');
      continue;
    }
    if (currentKey) {
      fields[currentKey] = multiline.trim();
      currentKey = null;
      multiline = '';
    }
    const km = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!km) continue;
    if (km[2] === '|' || km[2] === '') {
      currentKey = km[1];
      multiline = '';
    } else {
      fields[km[1]] = km[2].trim();
    }
  }
  if (currentKey) fields[currentKey] = multiline.trim();
  return {
    path: filePath,
    attackFamily: fields.attack_family as AttackFamily,
    attackId: fields.attack_id ?? '',
    expectedOutcome: (fields.expected_outcome ?? 'clean') as AdmissionDecision,
    expectedValidator: fields.expected_validator ?? '',
    expectedSeverity: (fields.expected_severity ?? 'LOW') as Severity,
    notes: fields.notes ?? '',
    content: body,
  };
}
