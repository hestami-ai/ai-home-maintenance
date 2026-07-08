/**
 * Craft-conformance detector (Phase 10.1, advisory by default).
 *
 * Measures whether the generated source actually followed the Engineering
 * Constitution's *checkable* craft expectations — exported symbols carry a
 * doc/why comment, and code cites the requirements it satisfies. slice-151
 * showed the executor reads the inlined constitution but doesn't act on it,
 * because craft doesn't affect the test/typecheck gate it optimises for. This
 * gives the executor prompt's "verified at Phase 10" claim a real check, makes
 * adherence visible + trackable run-over-run, and can be promoted to blocking
 * later. Deterministic, read-only, defensive (any IO error degrades to a
 * partial/empty report rather than throwing).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CraftConformanceReport {
  filesScanned: number;
  exportedSymbols: number;
  exportedSymbolsCommented: number;
  /** [0,1] — share of exported symbols preceded by a doc/line comment. */
  documentedRatio: number;
  filesCitingRequirements: number;
  /** Total requirement-id citations (CC-/AC-/SR-/FR-/NFR-/…) across source. */
  requirementCitations: number;
  /** Files with no comment of any kind. */
  uncommentedFiles: number;
}

// Requirement/decision id shapes the constitution asks code to cite.
const REQ_ID = /\b(?:CC|AC|SR|FR|NFR|DM|API|TECH|ADR|RSP|US)-[A-Za-z0-9][A-Za-z0-9-]*/g;
// A top-level exported declaration (function/class/const/interface/type/enum).
const EXPORTED = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|interface|type|enum)\s+\w/;

function collectSourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx|js|jsx|mts|cts)$/.test(e.name)) continue;
      if (/\.(test|spec)\./.test(e.name) || e.name.endsWith('.d.ts')) continue;
      out.push(full);
    }
  };
  walk(root);
  return out;
}

/**
 * Scan the generated project (prefers `<projectRoot>/src`, else `projectRoot`)
 * and return craft-conformance metrics.
 */
export function detectCraftConformance(projectRoot: string): CraftConformanceReport {
  const srcRoot = fs.existsSync(path.join(projectRoot, 'src'))
    ? path.join(projectRoot, 'src')
    : projectRoot;
  const files = collectSourceFiles(srcRoot);

  let exportedSymbols = 0;
  let exportedCommented = 0;
  let filesCiting = 0;
  let citations = 0;
  let uncommented = 0;

  for (const f of files) {
    let lines: string[];
    try { lines = fs.readFileSync(f, 'utf8').split(/\r?\n/); } catch { continue; }
    const text = lines.join('\n');

    const cites = text.match(REQ_ID);
    if (cites && cites.length > 0) { filesCiting++; citations += cites.length; }
    if (!/\/\/|\/\*/.test(text)) uncommented++;

    for (let i = 0; i < lines.length; i++) {
      if (!EXPORTED.test(lines[i])) continue;
      exportedSymbols++;
      // Commented iff the nearest preceding non-blank line is a comment / the
      // close of a block comment.
      let j = i - 1;
      while (j >= 0 && lines[j].trim() === '') j--;
      if (j >= 0 && /^\s*(?:\*\/|\/\/|\*|\/\*)/.test(lines[j])) exportedCommented++;
    }
  }

  return {
    filesScanned: files.length,
    exportedSymbols,
    exportedSymbolsCommented: exportedCommented,
    documentedRatio: exportedSymbols > 0 ? exportedCommented / exportedSymbols : 1,
    filesCitingRequirements: filesCiting,
    requirementCitations: citations,
    uncommentedFiles: uncommented,
  };
}
