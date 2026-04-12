/**
 * Verify that every probe test provides all required variables
 * for its template. This is a deterministic check that doesn't
 * require Ollama — it just inspects probe source files and template
 * frontmatter.
 *
 * Run: npx tsx scripts/verifyProbeVariables.ts
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { TemplateLoader } from '../src/lib/orchestrator/templateLoader';

const WORKSPACE = join(__dirname, '..');
const PROBES_DIR = join(WORKSPACE, 'src', 'test', 'prompt-probes');

interface ProbeReference {
  probeFile: string;
  templateKey: string | null;
  agentRole: string | null;
  subPhase: string | null;
  providedVariables: string[];
}

/**
 * Strip all string literals (single, double, and template) from TS source.
 * Replaces them with empty strings of the same type so that subsequent
 * regex matching against identifiers doesn't pick up content inside strings.
 */
function stripStringLiterals(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i];

    // Line comment
    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // String literal
    if (c === '"' || c === "'") {
      const quote = c;
      out += quote;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i++; // skip escape
        i++;
      }
      out += quote;
      i++;
      continue;
    }

    // Template literal (may contain ${...} but for our purposes we can strip all)
    if (c === '`') {
      out += '`';
      i++;
      while (i < source.length && source[i] !== '`') {
        if (source[i] === '\\') i++;
        // Skip ${...} expressions but treat the whole thing as opaque
        i++;
      }
      out += '`';
      i++;
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

/**
 * Find balanced braces — given source and the index of an opening '{',
 * walk forward respecting strings and comments to find the matching '}'.
 * Returns the index of the closing brace, or -1 if not found.
 */
function findBalancedClose(source: string, openIdx: number): number {
  let depth = 0;
  let i = openIdx;
  while (i < source.length) {
    const c = source[i];

    // Skip strings
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }

    if (c === '`') {
      i++;
      while (i < source.length && source[i] !== '`') {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }

    // Skip comments
    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }

    i++;
  }

  return -1;
}

/**
 * Extract probe references from a probe file.
 */
function extractProbeReferences(probeFilePath: string): ProbeReference[] {
  const rawContent = readFileSync(probeFilePath, 'utf-8');
  const refs: ProbeReference[] = [];

  // Find runProbe( occurrences
  let searchFrom = 0;
  while (true) {
    const callIdx = rawContent.indexOf('runProbe(', searchFrom);
    if (callIdx === -1) break;
    searchFrom = callIdx + 'runProbe('.length;

    // Find the opening { after runProbe(
    let p = searchFrom;
    while (p < rawContent.length && rawContent[p] !== '{') p++;
    if (p >= rawContent.length) continue;

    // Find the matching closing }
    const closeIdx = findBalancedClose(rawContent, p);
    if (closeIdx === -1) continue;

    const rawBlock = rawContent.slice(p + 1, closeIdx);

    // Extract templateKey, agentRole, subPhase via simple regex on raw block
    const templateKeyMatch = rawBlock.match(/templateKey\s*:\s*['"`]([^'"`]+)['"`]/);
    const agentRoleMatch = rawBlock.match(/agentRole\s*:\s*['"`]([^'"`]+)['"`]/);
    const subPhaseMatch = rawBlock.match(/subPhase\s*:\s*['"`]([^'"`]+)['"`]/);

    // Find variables: { ... } block via brace matching
    const providedVariables: string[] = [];
    const varsKeyIdx = rawBlock.indexOf('variables');
    if (varsKeyIdx !== -1) {
      // Find opening brace after 'variables:'
      let q = varsKeyIdx + 'variables'.length;
      while (q < rawBlock.length && rawBlock[q] !== '{') q++;
      if (q < rawBlock.length) {
        const varsCloseIdx = findBalancedClose(rawBlock, q);
        if (varsCloseIdx !== -1) {
          const varsBlock = rawBlock.slice(q + 1, varsCloseIdx);
          // Strip strings/comments so we don't catch keys inside JSON literals
          const stripped = stripStringLiterals(varsBlock);
          // Walk depth-tracked to find top-level identifiers followed by :
          let bd = 0;
          let i2 = 0;
          while (i2 < stripped.length) {
            const ch = stripped[i2];
            if (ch === '{' || ch === '[' || ch === '(') {
              bd++;
              i2++;
              continue;
            }
            if (ch === '}' || ch === ']' || ch === ')') {
              bd--;
              i2++;
              continue;
            }
            if (bd === 0 && /[a-zA-Z_]/.test(ch)) {
              let j = i2;
              while (j < stripped.length && /\w/.test(stripped[j])) j++;
              const ident = stripped.slice(i2, j);
              let k = j;
              while (k < stripped.length && /\s/.test(stripped[k])) k++;
              if (stripped[k] === ':') {
                providedVariables.push(ident);
                i2 = k + 1;
                continue;
              }
              i2 = j;
              continue;
            }
            i2++;
          }
        }
      }
    }

    refs.push({
      probeFile: probeFilePath,
      templateKey: templateKeyMatch?.[1] ?? null,
      agentRole: agentRoleMatch?.[1] ?? null,
      subPhase: subPhaseMatch?.[1] ?? null,
      providedVariables,
    });
  }

  return refs;
}

function main(): void {
  const loader = new TemplateLoader(WORKSPACE);
  const probeFiles = readdirSync(PROBES_DIR)
    .filter(f => f.endsWith('.probe.ts'))
    .map(f => join(PROBES_DIR, f));

  let totalProbes = 0;
  let totalIssues = 0;

  for (const probeFile of probeFiles) {
    const refs = extractProbeReferences(probeFile);

    for (const ref of refs) {
      totalProbes++;

      // Resolve template
      let template;
      if (ref.templateKey) {
        template = loader.getTemplate(ref.templateKey);
      } else if (ref.agentRole && ref.subPhase) {
        template = loader.findTemplate(ref.agentRole, ref.subPhase);
      }

      if (!template) {
        console.log(`✗ ${ref.probeFile.split(/[\\/]/).pop()}`);
        console.log(`  Template not found: ${ref.templateKey ?? `${ref.agentRole}/${ref.subPhase}`}`);
        totalIssues++;
        continue;
      }

      // Check required variables
      const required = template.metadata.required_variables;
      const provided = new Set(ref.providedVariables);
      const missing = required.filter(v => !provided.has(v));

      if (missing.length > 0) {
        console.log(`✗ ${ref.probeFile.split(/[\\/]/).pop()} (template: ${template.path})`);
        console.log(`  Missing variables: ${missing.join(', ')}`);
        console.log(`  Template requires: ${required.join(', ')}`);
        console.log(`  Probe provides: ${ref.providedVariables.join(', ')}`);
        totalIssues++;
      }
    }
  }

  console.log(`\n${totalProbes} probe references checked, ${totalIssues} issues found`);
  process.exit(totalIssues > 0 ? 1 : 0);
}

main();
